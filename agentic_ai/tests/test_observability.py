"""Tests for observability primitives."""

from __future__ import annotations

import pytest

from mcp_server.observability import (
    configure_observability,
    metrics,
    record_llm_call,
    traced,
    traced_async_span,
    traced_span,
)


def _value(metric, **labels) -> float:
    """Return numeric value of a labelled counter/gauge."""
    sample = metric.labels(**labels)._value.get() if labels else metric._value.get()
    return float(sample)


def test_configure_idempotent() -> None:
    configure_observability()
    configure_observability()  # should not raise


def test_metrics_singleton(fresh_metrics_registry) -> None:
    m1 = metrics()
    m2 = metrics()
    assert m1 is m2


def test_record_llm_call_increments(fresh_metrics_registry) -> None:
    m = fresh_metrics_registry
    record_llm_call(
        provider="openai",
        model="gpt-4o-mini",
        status="ok",
        duration_s=0.5,
        prompt_tokens=100,
        completion_tokens=200,
        cost_usd=0.001,
    )
    assert _value(m.llm_calls_total, provider="openai", model="gpt-4o-mini", status="ok") == 1.0
    assert (
        _value(m.llm_tokens_total, provider="openai", model="gpt-4o-mini", direction="prompt")
        == 100.0
    )
    assert (
        _value(m.llm_tokens_total, provider="openai", model="gpt-4o-mini", direction="completion")
        == 200.0
    )


def test_traced_span_sync(fresh_metrics_registry) -> None:
    with traced_span("test.span", foo="bar") as span:
        assert span is not None


@pytest.mark.asyncio
async def test_traced_async_span(fresh_metrics_registry) -> None:
    async with traced_async_span("test.async") as span:
        assert span is not None


@pytest.mark.asyncio
async def test_traced_decorator_async(fresh_metrics_registry) -> None:
    @traced("decorated")
    async def fn(x: int) -> int:
        return x + 1

    assert await fn(2) == 3


def test_traced_decorator_sync(fresh_metrics_registry) -> None:
    @traced("decorated.sync")
    def fn(x: int) -> int:
        return x * 2

    assert fn(3) == 6


@pytest.mark.asyncio
async def test_traced_span_records_errors(fresh_metrics_registry) -> None:
    m = fresh_metrics_registry
    with pytest.raises(RuntimeError):
        async with traced_async_span("err"):
            raise RuntimeError("nope")
    assert _value(m.errors_total, code="RuntimeError") >= 1.0
