"""Retry, timeout, and circuit-breaker primitives.

Combines `tenacity` (retry with jitter) and `pybreaker` (circuit breaker)
into helpers that callers can apply uniformly to every external call —
LLM providers, Redis, HTTP egress, vector DBs.

Design:
- Retries are only attempted for exceptions in `RETRYABLE_ERROR_TYPES`
  (defined in `errors.py`). Validation / 4xx never retry.
- Circuit breaker is per-resource (e.g. one per provider) so a misbehaving
  Anthropic doesn't trip OpenAI.
- Timeouts use `asyncio.wait_for` for async paths and `concurrent.futures`
  for sync — the API is uniform: pass `timeout_s`.
- Every retry attempt and breaker state change is emitted as a metric.
"""

from __future__ import annotations

import asyncio
import contextlib
import functools
import logging
import time
from collections.abc import Callable
from typing import Any, TypeVar, cast

import structlog
from tenacity import (
    AsyncRetrying,
    Retrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

try:
    from pybreaker import CircuitBreaker, CircuitBreakerError

    _PYBREAKER_AVAILABLE = True
except Exception:  # pragma: no cover - optional dep guard
    CircuitBreaker = None  # type: ignore[assignment,misc]
    CircuitBreakerError = Exception  # type: ignore[assignment,misc]
    _PYBREAKER_AVAILABLE = False

from .errors import (
    RETRYABLE_ERROR_TYPES,
    CircuitOpenError,
    TimeoutError_,
)
from .observability import metrics

logger = structlog.get_logger("mcp_server.resilience")


T = TypeVar("T")
F = TypeVar("F", bound=Callable[..., Any])


# ─── Circuit breaker registry ─────────────────────────────────────────────

_breakers: dict[str, Any] = {}


class _BreakerListener:
    """Capture state transitions for metrics + logs."""

    def __init__(self, name: str) -> None:
        self.name = name

    def state_change(self, cb: Any, old_state: Any, new_state: Any) -> None:
        state_name = getattr(new_state, "name", str(new_state)).lower()
        mapping = {"closed": 0, "half_open": 1, "open": 2, "half-open": 1}
        with contextlib.suppress(Exception):  # pragma: no cover - best-effort
            metrics().circuit_state.labels(name=self.name).set(mapping.get(state_name, 0))
        logger.warning(
            "circuit.state_change",
            breaker=self.name,
            old_state=getattr(old_state, "name", str(old_state)),
            new_state=state_name,
        )

    def failure(self, cb: Any, exc: BaseException) -> None:
        logger.warning("circuit.failure", breaker=self.name, error=str(exc))

    def success(self, cb: Any) -> None:
        pass

    def before_call(self, cb: Any, func: Callable[..., Any], *args: Any, **kwargs: Any) -> None:
        pass


def get_breaker(
    name: str,
    *,
    fail_max: int = 5,
    reset_timeout_s: int = 30,
) -> Any:
    """Get or create a named circuit breaker. Cached per name."""
    if name in _breakers:
        return _breakers[name]

    if not _PYBREAKER_AVAILABLE:
        breaker: Any = _NoopBreaker(name)
    else:
        breaker = CircuitBreaker(
            fail_max=fail_max,
            reset_timeout=reset_timeout_s,
            listeners=[_BreakerListener(name)],
            name=name,
        )
        metrics().circuit_state.labels(name=name).set(0)

    _breakers[name] = breaker
    return breaker


class _NoopBreaker:
    """Fallback when pybreaker is not installed (tests, lean installs)."""

    def __init__(self, name: str) -> None:
        self.name = name

    def __call__(self, func: F) -> F:
        return func

    async def call_async(self, func: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
        return await func(*args, **kwargs)

    def call(self, func: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
        return func(*args, **kwargs)


# ─── Retry helpers ────────────────────────────────────────────────────────

DEFAULT_MAX_ATTEMPTS = 3
DEFAULT_INITIAL_BACKOFF_S = 0.25
DEFAULT_MAX_BACKOFF_S = 8.0


def _retry_policy(
    *,
    max_attempts: int,
    initial_s: float,
    max_s: float,
    retry_on: tuple[type[BaseException], ...],
) -> dict[str, Any]:
    return {
        "stop": stop_after_attempt(max_attempts),
        "wait": wait_exponential_jitter(initial=initial_s, max=max_s, exp_base=2, jitter=initial_s),
        "retry": retry_if_exception_type(retry_on),
        "reraise": True,
    }


def with_retries(
    operation: str | None = None,
    *,
    max_attempts: int = DEFAULT_MAX_ATTEMPTS,
    initial_backoff_s: float = DEFAULT_INITIAL_BACKOFF_S,
    max_backoff_s: float = DEFAULT_MAX_BACKOFF_S,
    retry_on: tuple[type[BaseException], ...] = RETRYABLE_ERROR_TYPES,
) -> Callable[[F], F]:
    """Decorator: retry with exponential backoff + jitter on transient errors."""

    def wrap(fn: F) -> F:
        op_name = operation or fn.__qualname__

        if asyncio.iscoroutinefunction(fn):

            @functools.wraps(fn)
            async def async_inner(*args: Any, **kwargs: Any) -> Any:
                policy = _retry_policy(
                    max_attempts=max_attempts,
                    initial_s=initial_backoff_s,
                    max_s=max_backoff_s,
                    retry_on=retry_on,
                )
                last_exc: BaseException | None = None
                attempt = 0
                try:
                    async for attempt_obj in AsyncRetrying(**policy):
                        attempt += 1
                        with attempt_obj:
                            try:
                                result = await fn(*args, **kwargs)
                            except retry_on as exc:  # type: ignore[misc]
                                last_exc = exc
                                logger.warning(
                                    "retry.attempt",
                                    operation=op_name,
                                    attempt=attempt,
                                    error=str(exc),
                                )
                                raise
                            metrics().retries_total.labels(
                                operation=op_name, outcome="success"
                            ).inc()
                            return result
                except retry_on:  # type: ignore[misc]
                    metrics().retries_total.labels(operation=op_name, outcome="failure").inc()
                    raise
                # Unreachable but keeps mypy happy.
                if last_exc:  # pragma: no cover
                    raise last_exc
                return None

            return cast(F, async_inner)

        @functools.wraps(fn)
        def sync_inner(*args: Any, **kwargs: Any) -> Any:
            policy = _retry_policy(
                max_attempts=max_attempts,
                initial_s=initial_backoff_s,
                max_s=max_backoff_s,
                retry_on=retry_on,
            )
            attempt = 0
            try:
                for attempt_obj in Retrying(**policy):
                    attempt += 1
                    with attempt_obj:
                        try:
                            result = fn(*args, **kwargs)
                        except retry_on as exc:  # type: ignore[misc]
                            logger.warning(
                                "retry.attempt",
                                operation=op_name,
                                attempt=attempt,
                                error=str(exc),
                            )
                            raise
                        metrics().retries_total.labels(operation=op_name, outcome="success").inc()
                        return result
            except retry_on:  # type: ignore[misc]
                metrics().retries_total.labels(operation=op_name, outcome="failure").inc()
                raise
            return None  # pragma: no cover

        return cast(F, sync_inner)

    return wrap


# ─── Timeout helpers ──────────────────────────────────────────────────────


async def with_async_timeout(
    coro: Any,
    *,
    timeout_s: float,
    operation: str,
) -> Any:
    """Run `coro` under a deadline. Raises `TimeoutError_` on expiry."""
    try:
        return await asyncio.wait_for(coro, timeout=timeout_s)
    except TimeoutError as exc:
        logger.warning("timeout", operation=operation, timeout_s=timeout_s)
        raise TimeoutError_(
            f"{operation} exceeded deadline of {timeout_s:.2f}s",
            context={"operation": operation, "timeout_s": timeout_s},
        ) from exc


# ─── High-level combinator: retry + circuit + timeout ─────────────────────


def guarded_call(
    *,
    name: str,
    timeout_s: float | None = None,
    max_attempts: int = DEFAULT_MAX_ATTEMPTS,
    breaker_fail_max: int = 5,
    breaker_reset_timeout_s: int = 30,
    retry_on: tuple[type[BaseException], ...] = RETRYABLE_ERROR_TYPES,
) -> Callable[[F], F]:
    """Apply retry + circuit breaker + optional timeout to a callable.

    Order: outer = breaker, middle = retry, inner = timeout. This way a
    breaker trip short-circuits future retries.
    """

    breaker = get_breaker(name, fail_max=breaker_fail_max, reset_timeout_s=breaker_reset_timeout_s)

    def wrap(fn: F) -> F:
        if asyncio.iscoroutinefunction(fn):

            @with_retries(operation=name, max_attempts=max_attempts, retry_on=retry_on)
            @functools.wraps(fn)
            async def retried(*args: Any, **kwargs: Any) -> Any:
                if timeout_s is not None:
                    return await with_async_timeout(
                        fn(*args, **kwargs),
                        timeout_s=timeout_s,
                        operation=name,
                    )
                return await fn(*args, **kwargs)

            @functools.wraps(fn)
            async def guarded(*args: Any, **kwargs: Any) -> Any:
                try:
                    return await breaker.call_async(retried, *args, **kwargs)
                except CircuitBreakerError as exc:
                    metrics().errors_total.labels(code="circuit_open").inc()
                    raise CircuitOpenError(
                        f"Circuit '{name}' is open",
                        context={"breaker": name},
                    ) from exc

            return cast(F, guarded)

        @with_retries(operation=name, max_attempts=max_attempts, retry_on=retry_on)
        @functools.wraps(fn)
        def retried_sync(*args: Any, **kwargs: Any) -> Any:
            if timeout_s is not None:
                # Sync timeout uses a thread; only safe for IO calls.
                return _run_with_thread_timeout(
                    fn, args, kwargs, timeout_s=timeout_s, operation=name
                )
            return fn(*args, **kwargs)

        @functools.wraps(fn)
        def guarded_sync(*args: Any, **kwargs: Any) -> Any:
            try:
                return breaker.call(retried_sync, *args, **kwargs)
            except CircuitBreakerError as exc:
                metrics().errors_total.labels(code="circuit_open").inc()
                raise CircuitOpenError(
                    f"Circuit '{name}' is open",
                    context={"breaker": name},
                ) from exc

        return cast(F, guarded_sync)

    return wrap


def _run_with_thread_timeout(
    fn: Callable[..., Any],
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
    *,
    timeout_s: float,
    operation: str,
) -> Any:
    """Best-effort sync timeout via a worker thread."""
    import concurrent.futures

    start = time.monotonic()
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(fn, *args, **kwargs)
        try:
            return future.result(timeout=timeout_s)
        except concurrent.futures.TimeoutError as exc:
            elapsed = time.monotonic() - start
            logger.warning(
                "timeout.sync",
                operation=operation,
                timeout_s=timeout_s,
                elapsed_s=elapsed,
            )
            future.cancel()
            raise TimeoutError_(
                f"{operation} exceeded sync deadline of {timeout_s:.2f}s",
                context={"operation": operation, "timeout_s": timeout_s},
            ) from exc


# Quiet tenacity's own logger to avoid duplicate warnings.
logging.getLogger("tenacity").setLevel(logging.WARNING)
