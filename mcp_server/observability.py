"""Observability primitives: OpenTelemetry tracing + Prometheus metrics.

Public entry points:
- `configure_observability()` — idempotent setup. Called from app bootstrap.
- `tracer` — module-level tracer reused across the codebase.
- `metrics` — singleton container for typed Prometheus collectors.
- `traced(name)` — decorator + context manager that opens a span and
  records exceptions / duration.
- `record_llm_call(...)` — convenience for LLM provider call telemetry.

The module degrades gracefully if OTel exporters are not installed or
endpoints are unreachable — instrumentation never crashes the app.
"""

from __future__ import annotations

import functools
import os
import time
from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager, contextmanager
from typing import Any, TypeVar

from prometheus_client import (
    CollectorRegistry,
    Counter,
    Gauge,
    Histogram,
    multiprocess,
)

try:
    from opentelemetry import trace
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import (
        BatchSpanProcessor,
        ConsoleSpanExporter,
    )
    from opentelemetry.trace import Status, StatusCode, SpanKind
    _OTEL_AVAILABLE = True
except Exception:  # pragma: no cover - import guard
    _OTEL_AVAILABLE = False
    trace = None  # type: ignore[assignment]

# ─── Resource + provider setup ────────────────────────────────────────────

_CONFIGURED = False
_TRACER_NAME = "synthora-mcp"


def _build_resource() -> "Resource":  # type: ignore[name-defined]
    from agentic_ai.config.settings import settings

    attrs: dict[str, Any] = {
        "service.name": settings.mcp_server_name,
        "service.version": settings.mcp_server_version,
        "service.namespace": "synthora",
        "deployment.environment": settings.environment,
    }
    extra = os.environ.get("OTEL_RESOURCE_ATTRIBUTES", "")
    for item in extra.split(","):
        if "=" in item:
            k, v = item.split("=", 1)
            attrs[k.strip()] = v.strip()
    return Resource.create(attrs)


def _build_exporter() -> Any:
    """Choose OTLP exporter by environment. Falls back to console in dev."""
    endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "").strip()
    protocol = os.environ.get("OTEL_EXPORTER_OTLP_PROTOCOL", "grpc").strip().lower()

    if not endpoint:
        return ConsoleSpanExporter()

    try:
        if protocol == "http/protobuf":
            from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
                OTLPSpanExporter as HTTPExporter,
            )
            return HTTPExporter(endpoint=endpoint)
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
            OTLPSpanExporter as GRPCExporter,
        )
        return GRPCExporter(endpoint=endpoint, insecure=endpoint.startswith("http://"))
    except Exception:  # pragma: no cover - exporter optional
        return ConsoleSpanExporter()


def configure_observability() -> None:
    """Idempotent OTel + metrics setup. Call once at process start."""
    global _CONFIGURED  # noqa: PLW0603
    if _CONFIGURED:
        return

    if _OTEL_AVAILABLE:
        provider = TracerProvider(resource=_build_resource())
        provider.add_span_processor(BatchSpanProcessor(_build_exporter()))
        trace.set_tracer_provider(provider)

    _CONFIGURED = True


def get_tracer() -> Any:
    """Return the canonical tracer. Safe even before configure() runs."""
    if not _OTEL_AVAILABLE:
        return _NoopTracer()
    return trace.get_tracer(_TRACER_NAME)


# ─── No-op fallback so callers never crash on missing OTel ────────────────

class _NoopSpan:
    def set_attribute(self, *_a: Any, **_kw: Any) -> None: ...
    def set_status(self, *_a: Any, **_kw: Any) -> None: ...
    def record_exception(self, *_a: Any, **_kw: Any) -> None: ...
    def add_event(self, *_a: Any, **_kw: Any) -> None: ...
    def end(self) -> None: ...
    def __enter__(self) -> "_NoopSpan": return self
    def __exit__(self, *_exc: Any) -> None: return None


class _NoopTracer:
    def start_as_current_span(self, *_a: Any, **_kw: Any) -> _NoopSpan:  # type: ignore[override]
        return _NoopSpan()

    def start_span(self, *_a: Any, **_kw: Any) -> _NoopSpan:  # type: ignore[override]
        return _NoopSpan()


# ─── Prometheus metric registry ───────────────────────────────────────────

def _registry() -> CollectorRegistry:
    if "PROMETHEUS_MULTIPROC_DIR" in os.environ:
        registry = CollectorRegistry()
        multiprocess.MultiProcessCollector(registry)
        return registry
    return CollectorRegistry(auto_describe=True)


class Metrics:
    """Typed registry of Prometheus collectors used across the codebase."""

    def __init__(self) -> None:
        self.registry = _registry()

        self.pipeline_runs_total = Counter(
            "synthora_pipeline_runs_total",
            "Total pipeline executions by terminal status.",
            ["status"],
            registry=self.registry,
        )
        self.pipeline_duration_seconds = Histogram(
            "synthora_pipeline_duration_seconds",
            "End-to-end pipeline duration.",
            ["status"],
            registry=self.registry,
            buckets=(0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20, 60, 120, 300, 600),
        )
        self.agent_invocations_total = Counter(
            "synthora_agent_invocations_total",
            "Per-agent invocations by terminal status.",
            ["agent", "status"],
            registry=self.registry,
        )
        self.agent_duration_seconds = Histogram(
            "synthora_agent_duration_seconds",
            "Per-agent execution duration.",
            ["agent"],
            registry=self.registry,
            buckets=(0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60),
        )
        self.llm_calls_total = Counter(
            "synthora_llm_calls_total",
            "LLM provider calls by provider + model + status.",
            ["provider", "model", "status"],
            registry=self.registry,
        )
        self.llm_duration_seconds = Histogram(
            "synthora_llm_duration_seconds",
            "LLM provider call duration.",
            ["provider", "model"],
            registry=self.registry,
            buckets=(0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120),
        )
        self.llm_tokens_total = Counter(
            "synthora_llm_tokens_total",
            "Tokens by provider/model/direction (prompt|completion).",
            ["provider", "model", "direction"],
            registry=self.registry,
        )
        self.llm_cost_usd_total = Counter(
            "synthora_llm_cost_usd_total",
            "Estimated LLM cost in USD by provider/model.",
            ["provider", "model"],
            registry=self.registry,
        )
        self.mcp_tool_invocations_total = Counter(
            "synthora_mcp_tool_invocations_total",
            "MCP tool invocations by tool + status.",
            ["tool", "status"],
            registry=self.registry,
        )
        self.mcp_tool_duration_seconds = Histogram(
            "synthora_mcp_tool_duration_seconds",
            "MCP tool duration.",
            ["tool"],
            registry=self.registry,
        )
        self.acp_messages_total = Counter(
            "synthora_acp_messages_total",
            "ACP messages by direction (sent|received|ack).",
            ["direction"],
            registry=self.registry,
        )
        self.acp_agents_registered = Gauge(
            "synthora_acp_agents_registered",
            "Currently registered ACP agents.",
            registry=self.registry,
        )
        self.job_queue_depth = Gauge(
            "synthora_job_queue_depth",
            "Queue depth by status.",
            ["status"],
            registry=self.registry,
        )
        self.circuit_state = Gauge(
            "synthora_circuit_breaker_state",
            "Circuit breaker state. 0=closed, 1=half_open, 2=open.",
            ["name"],
            registry=self.registry,
        )
        self.retries_total = Counter(
            "synthora_retries_total",
            "Retried operations by name and final outcome.",
            ["operation", "outcome"],
            registry=self.registry,
        )
        self.errors_total = Counter(
            "synthora_errors_total",
            "Errors by code.",
            ["code"],
            registry=self.registry,
        )


_metrics: Metrics | None = None


def metrics() -> Metrics:
    global _metrics  # noqa: PLW0603
    if _metrics is None:
        _metrics = Metrics()
    return _metrics


# ─── Tracing helpers ──────────────────────────────────────────────────────

F = TypeVar("F", bound=Callable[..., Any])


@contextmanager
def traced_span(name: str, **attributes: Any) -> Any:
    """Sync context manager that opens a span with attributes."""
    tracer = get_tracer()
    with tracer.start_as_current_span(name) as span:
        for k, v in attributes.items():
            try:
                span.set_attribute(k, v)
            except Exception:  # pragma: no cover - defensive
                pass
        start = time.monotonic()
        try:
            yield span
        except Exception as exc:
            try:
                if _OTEL_AVAILABLE:
                    span.set_status(Status(StatusCode.ERROR, str(exc)))
                span.record_exception(exc)
            except Exception:  # pragma: no cover
                pass
            metrics().errors_total.labels(code=type(exc).__name__).inc()
            raise
        finally:
            try:
                span.set_attribute("duration_ms", int((time.monotonic() - start) * 1000))
            except Exception:  # pragma: no cover
                pass


@asynccontextmanager
async def traced_async_span(name: str, **attributes: Any) -> Any:
    """Async variant of `traced_span`."""
    tracer = get_tracer()
    with tracer.start_as_current_span(name) as span:
        for k, v in attributes.items():
            try:
                span.set_attribute(k, v)
            except Exception:  # pragma: no cover
                pass
        start = time.monotonic()
        try:
            yield span
        except Exception as exc:
            try:
                if _OTEL_AVAILABLE:
                    span.set_status(Status(StatusCode.ERROR, str(exc)))
                span.record_exception(exc)
            except Exception:  # pragma: no cover
                pass
            metrics().errors_total.labels(code=type(exc).__name__).inc()
            raise
        finally:
            try:
                span.set_attribute("duration_ms", int((time.monotonic() - start) * 1000))
            except Exception:  # pragma: no cover
                pass


def traced(name: str | None = None, **default_attrs: Any) -> Callable[[F], F]:
    """Decorator that wraps a function in a span. Sync or async-aware."""

    def wrap(fn: F) -> F:
        span_name = name or fn.__qualname__

        if _is_coroutine_function(fn):
            @functools.wraps(fn)
            async def async_inner(*args: Any, **kwargs: Any) -> Any:
                async with traced_async_span(span_name, **default_attrs):
                    return await fn(*args, **kwargs)
            return async_inner  # type: ignore[return-value]

        @functools.wraps(fn)
        def sync_inner(*args: Any, **kwargs: Any) -> Any:
            with traced_span(span_name, **default_attrs):
                return fn(*args, **kwargs)
        return sync_inner  # type: ignore[return-value]

    return wrap


def _is_coroutine_function(fn: Callable[..., Any]) -> bool:
    import asyncio
    import inspect
    return asyncio.iscoroutinefunction(fn) or inspect.iscoroutinefunction(fn)


# ─── LLM call telemetry ───────────────────────────────────────────────────

def record_llm_call(
    *,
    provider: str,
    model: str,
    status: str,
    duration_s: float,
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
    cost_usd: float | None = None,
) -> None:
    """Emit metrics for a completed LLM call."""
    m = metrics()
    m.llm_calls_total.labels(provider=provider, model=model, status=status).inc()
    m.llm_duration_seconds.labels(provider=provider, model=model).observe(duration_s)
    if prompt_tokens is not None and prompt_tokens > 0:
        m.llm_tokens_total.labels(provider=provider, model=model, direction="prompt").inc(prompt_tokens)
    if completion_tokens is not None and completion_tokens > 0:
        m.llm_tokens_total.labels(provider=provider, model=model, direction="completion").inc(completion_tokens)
    if cost_usd is not None and cost_usd > 0:
        m.llm_cost_usd_total.labels(provider=provider, model=model).inc(cost_usd)


# Convenience: SpanKind export so callers don't need to import opentelemetry.
SPAN_KIND_CLIENT = getattr(SpanKind, "CLIENT", None) if _OTEL_AVAILABLE else None
SPAN_KIND_SERVER = getattr(SpanKind, "SERVER", None) if _OTEL_AVAILABLE else None
SPAN_KIND_INTERNAL = getattr(SpanKind, "INTERNAL", None) if _OTEL_AVAILABLE else None

tracer = get_tracer()
