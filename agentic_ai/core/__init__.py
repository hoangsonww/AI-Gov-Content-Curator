"""Core module for the Agentic AI Pipeline.

Also re-exports observability / resilience / error types from `mcp_server`
so callers within `agentic_ai/` have a single import surface for these
cross-cutting primitives.
"""

from __future__ import annotations

from mcp_server.errors import (
    AuthorizationError,
    CircuitOpenError,
    ConfigurationError,
    ConflictError,
    MCPError,
    NotFoundError,
    PermanentUpstreamError,
    ResourceExhaustedError,
    TimeoutError_,
    TransientUpstreamError,
    UpstreamError,
    ValidationError,
)
from mcp_server.observability import (
    configure_observability,
    metrics,
    record_llm_call,
    traced,
    traced_async_span,
    traced_span,
)
from mcp_server.resilience import (
    DEFAULT_INITIAL_BACKOFF_S,
    DEFAULT_MAX_ATTEMPTS,
    DEFAULT_MAX_BACKOFF_S,
    get_breaker,
    guarded_call,
    with_async_timeout,
    with_retries,
)

from .pipeline import AgenticPipeline, AgentState, PipelineStage

__all__ = [
    "AgenticPipeline",
    "AgentState",
    "AuthorizationError",
    "CircuitOpenError",
    "ConfigurationError",
    "ConflictError",
    "DEFAULT_INITIAL_BACKOFF_S",
    "DEFAULT_MAX_ATTEMPTS",
    "DEFAULT_MAX_BACKOFF_S",
    "MCPError",
    "NotFoundError",
    "PermanentUpstreamError",
    "PipelineStage",
    "ResourceExhaustedError",
    "TimeoutError_",
    "TransientUpstreamError",
    "UpstreamError",
    "ValidationError",
    "configure_observability",
    "get_breaker",
    "guarded_call",
    "metrics",
    "record_llm_call",
    "traced",
    "traced_async_span",
    "traced_span",
    "with_async_timeout",
    "with_retries",
]
