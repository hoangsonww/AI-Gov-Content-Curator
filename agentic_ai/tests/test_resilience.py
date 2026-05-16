"""Tests for retry / timeout / circuit breaker primitives."""

from __future__ import annotations

import asyncio

import pytest

from mcp_server.errors import (
    CircuitOpenError,
    TimeoutError_,
    TransientUpstreamError,
)
from mcp_server.resilience import (
    get_breaker,
    guarded_call,
    with_async_timeout,
    with_retries,
)

pytestmark = pytest.mark.asyncio


# ─── with_retries ────────────────────────────────────────────────────────


async def test_with_retries_succeeds_first_try(reset_circuit_breakers, fresh_metrics_registry):
    calls = {"n": 0}

    @with_retries(operation="t", max_attempts=3)
    async def ok() -> str:
        calls["n"] += 1
        return "ok"

    assert await ok() == "ok"
    assert calls["n"] == 1


async def test_with_retries_recovers_after_transient_failure(
    reset_circuit_breakers, fresh_metrics_registry
):
    calls = {"n": 0}

    @with_retries(operation="t2", max_attempts=3, initial_backoff_s=0.01, max_backoff_s=0.02)
    async def flaky() -> str:
        calls["n"] += 1
        if calls["n"] < 3:
            raise TransientUpstreamError("nope")
        return "done"

    assert await flaky() == "done"
    assert calls["n"] == 3


async def test_with_retries_exhausts_and_reraises(reset_circuit_breakers, fresh_metrics_registry):
    @with_retries(operation="t3", max_attempts=2, initial_backoff_s=0.01, max_backoff_s=0.02)
    async def broken() -> None:
        raise TransientUpstreamError("always")

    with pytest.raises(TransientUpstreamError):
        await broken()


async def test_with_retries_does_not_retry_non_transient(
    reset_circuit_breakers, fresh_metrics_registry
):
    calls = {"n": 0}

    @with_retries(operation="t4", max_attempts=3, initial_backoff_s=0.01, max_backoff_s=0.02)
    async def bad() -> None:
        calls["n"] += 1
        raise ValueError("not retryable")

    with pytest.raises(ValueError):
        await bad()
    assert calls["n"] == 1


# ─── with_async_timeout ──────────────────────────────────────────────────


async def test_timeout_completes_within_deadline() -> None:
    async def slow() -> str:
        await asyncio.sleep(0.01)
        return "ok"

    assert await with_async_timeout(slow(), timeout_s=1.0, operation="t") == "ok"


async def test_timeout_raises_when_exceeded() -> None:
    async def slow() -> None:
        await asyncio.sleep(0.5)

    with pytest.raises(TimeoutError_):
        await with_async_timeout(slow(), timeout_s=0.05, operation="t")


# ─── guarded_call (retry + breaker + timeout) ────────────────────────────


async def test_guarded_call_success(reset_circuit_breakers, fresh_metrics_registry):
    @guarded_call(name="g.ok", timeout_s=1.0, max_attempts=3)
    async def fn(x: int) -> int:
        return x * 2

    assert await fn(3) == 6


async def test_guarded_call_breaker_opens(reset_circuit_breakers, fresh_metrics_registry):
    @guarded_call(
        name="g.break",
        timeout_s=1.0,
        max_attempts=1,  # disable retries so each call counts
        breaker_fail_max=2,
        breaker_reset_timeout_s=60,
    )
    async def broken() -> None:
        raise TransientUpstreamError("boom")

    for _ in range(2):
        with pytest.raises(TransientUpstreamError):
            await broken()

    # Third call should be short-circuited by the breaker.
    with pytest.raises(CircuitOpenError):
        await broken()


async def test_guarded_call_breaker_half_open_recovers(
    reset_circuit_breakers, fresh_metrics_registry
):
    """After the reset timeout, a successful trial closes the breaker."""
    state = {"fail": True}

    @guarded_call(
        name="g.recover",
        max_attempts=1,
        breaker_fail_max=1,
        breaker_reset_timeout_s=0,  # immediate half-open eligibility
    )
    async def flaky() -> str:
        if state["fail"]:
            raise TransientUpstreamError("down")
        return "ok"

    with pytest.raises(TransientUpstreamError):
        await flaky()  # trips breaker (fail_max=1)

    # reset_timeout=0 → next call is admitted as a HALF_OPEN trial.
    state["fail"] = False
    assert await flaky() == "ok"

    breaker = get_breaker("g.recover")
    assert breaker.state == "closed"


async def test_circuit_breaker_ignores_non_countable_errors(reset_circuit_breakers):
    """Validation-style errors must not trip the breaker."""
    from mcp_server.resilience import CircuitBreaker

    breaker = CircuitBreaker("nc", fail_max=1)

    def bad() -> None:
        raise ValueError("not a transient error")

    for _ in range(5):
        with pytest.raises(ValueError):
            breaker.call(bad)
    assert breaker.state == "closed"


async def test_get_breaker_returns_cached(reset_circuit_breakers):
    b1 = get_breaker("cached")
    b2 = get_breaker("cached")
    assert b1 is b2
