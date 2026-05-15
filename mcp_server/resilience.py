"""Retry, timeout, and circuit-breaker primitives.

Combines `tenacity` (retry with jitter) with a self-contained circuit
breaker into helpers that callers apply uniformly to every external
call — LLM providers, Redis, HTTP egress, vector DBs.

Design:
- Retries are only attempted for exceptions in `RETRYABLE_ERROR_TYPES`
  (defined in `errors.py`). Validation / 4xx never retry.
- Circuit breaker is per-resource (e.g. one per provider) so a misbehaving
  Anthropic doesn't trip OpenAI.
- Timeouts use `asyncio.wait_for` for async paths and `concurrent.futures`
  for sync — the API is uniform: pass `timeout_s`.
- Every retry attempt and breaker state change is emitted as a metric.

The circuit breaker is implemented in-process (no third-party dep): the
widely used `pybreaker` ships only a Tornado-based `call_async`, which
is unusable from asyncio. A purpose-built breaker keeps sync + async
behaviour identical and fully under test.
"""

from __future__ import annotations

import asyncio
import contextlib
import functools
import logging
import threading
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

from .errors import (
    RETRYABLE_ERROR_TYPES,
    CircuitOpenError,
    TimeoutError_,
)
from .observability import metrics

logger = structlog.get_logger("mcp_server.resilience")


T = TypeVar("T")
F = TypeVar("F", bound=Callable[..., Any])


# ─── Circuit breaker ──────────────────────────────────────────────────────

# State values double as the Prometheus gauge value.
_STATE_CLOSED = 0
_STATE_HALF_OPEN = 1
_STATE_OPEN = 2
_STATE_NAMES = {_STATE_CLOSED: "closed", _STATE_HALF_OPEN: "half_open", _STATE_OPEN: "open"}


class CircuitBreaker:
    """Per-resource circuit breaker, safe for sync and asyncio callers.

    - CLOSED: calls pass through; consecutive failures are counted; on the
      `fail_max`-th failure the breaker trips to OPEN.
    - OPEN: calls fail fast with `CircuitOpenError` until `reset_timeout_s`
      has elapsed, then the next call is allowed through as a HALF_OPEN
      trial.
    - HALF_OPEN: a single trial call is allowed; success closes the
      breaker, failure re-opens it and restarts the timer.

    Only exceptions in `count_exc` count as failures (transient/upstream).
    Validation-style errors pass through without tripping the breaker.
    """

    def __init__(
        self,
        name: str,
        *,
        fail_max: int = 5,
        reset_timeout_s: float = 30.0,
        count_exc: tuple[type[BaseException], ...] = RETRYABLE_ERROR_TYPES,
    ) -> None:
        self.name = name
        self.fail_max = max(1, fail_max)
        self.reset_timeout_s = float(reset_timeout_s)
        self._count_exc = count_exc
        self._state = _STATE_CLOSED
        self._fail_count = 0
        self._opened_at = 0.0
        self._lock = threading.Lock()
        self._publish_state()

    # -- state helpers ----------------------------------------------------

    @property
    def state(self) -> str:
        return _STATE_NAMES[self._state]

    def _publish_state(self) -> None:
        with contextlib.suppress(Exception):  # best-effort metric
            metrics().circuit_state.labels(name=self.name).set(self._state)

    def _transition(self, new_state: int) -> None:
        if new_state == self._state:
            return
        old = _STATE_NAMES[self._state]
        self._state = new_state
        if new_state == _STATE_OPEN:
            self._opened_at = time.monotonic()
        if new_state == _STATE_CLOSED:
            self._fail_count = 0
        logger.warning(
            "circuit.state_change",
            breaker=self.name,
            old_state=old,
            new_state=_STATE_NAMES[new_state],
        )
        self._publish_state()

    def _before_call(self) -> None:
        """Raise `CircuitOpenError` if the breaker is open; else admit."""
        with self._lock:
            if self._state == _STATE_OPEN:
                if time.monotonic() - self._opened_at >= self.reset_timeout_s:
                    self._transition(_STATE_HALF_OPEN)
                else:
                    metrics().errors_total.labels(code="circuit_open").inc()
                    raise CircuitOpenError(
                        f"Circuit '{self.name}' is open",
                        context={"breaker": self.name},
                    )

    def _on_success(self) -> None:
        with self._lock:
            self._fail_count = 0
            if self._state != _STATE_CLOSED:
                self._transition(_STATE_CLOSED)

    def _on_failure(self, exc: BaseException) -> None:
        if not isinstance(exc, self._count_exc):
            return  # non-countable error — leave the breaker untouched
        with self._lock:
            logger.warning("circuit.failure", breaker=self.name, error=str(exc))
            if self._state == _STATE_HALF_OPEN:
                self._transition(_STATE_OPEN)
                return
            self._fail_count += 1
            if self._fail_count >= self.fail_max:
                self._transition(_STATE_OPEN)

    # -- call wrappers ----------------------------------------------------

    def call(self, func: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
        self._before_call()
        try:
            result = func(*args, **kwargs)
        except BaseException as exc:
            self._on_failure(exc)
            raise
        self._on_success()
        return result

    async def call_async(self, func: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
        self._before_call()
        try:
            result = await func(*args, **kwargs)
        except BaseException as exc:
            self._on_failure(exc)
            raise
        self._on_success()
        return result


# ─── Circuit breaker registry ─────────────────────────────────────────────

_breakers: dict[str, CircuitBreaker] = {}
_breakers_lock = threading.Lock()


def get_breaker(
    name: str,
    *,
    fail_max: int = 5,
    reset_timeout_s: int = 30,
) -> CircuitBreaker:
    """Get or create a named circuit breaker. Cached + shared per name."""
    breaker = _breakers.get(name)
    if breaker is not None:
        return breaker
    with _breakers_lock:
        breaker = _breakers.get(name)
        if breaker is None:
            breaker = CircuitBreaker(
                name, fail_max=fail_max, reset_timeout_s=float(reset_timeout_s)
            )
            _breakers[name] = breaker
    return breaker


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
        # Order: breaker (outer) → retry (middle) → timeout (inner). A
        # tripped breaker short-circuits before any retry is attempted.
        # The breaker raises `CircuitOpenError` itself, so callers see a
        # typed error without extra translation here.
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
                return await breaker.call_async(retried, *args, **kwargs)

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
            return breaker.call(retried_sync, *args, **kwargs)

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
