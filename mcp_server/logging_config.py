"""
Logging configuration utilities for the MCP server.

- Output goes to stderr to keep stdio MCP transport clean.
- JSON renderer by default for production aggregation.
- Trace IDs from the active OTel span are injected into every record so
  logs and traces correlate in tools like Tempo/Grafana/Honeycomb.
- Every record passes through the secret redaction processor so we never
  leak API keys or tokens.
"""

from __future__ import annotations

import logging
import sys
from typing import Any

import structlog

from agentic_ai.config.settings import settings

from .security import structlog_redact_processor

try:
    from opentelemetry import trace as _otel_trace
    _OTEL_AVAILABLE = True
except Exception:  # pragma: no cover - optional dep
    _OTEL_AVAILABLE = False
    _otel_trace = None  # type: ignore[assignment]


def _inject_trace_context(
    logger: Any, method_name: str, event_dict: dict[str, Any]
) -> dict[str, Any]:  # noqa: ARG001
    """Add trace_id / span_id from current OTel span to each log record."""
    if not _OTEL_AVAILABLE:
        return event_dict
    span = _otel_trace.get_current_span()
    if not span:
        return event_dict
    ctx = span.get_span_context()
    if not ctx or not getattr(ctx, "is_valid", False):
        return event_dict
    event_dict["trace_id"] = format(ctx.trace_id, "032x")
    event_dict["span_id"] = format(ctx.span_id, "016x")
    return event_dict


def _add_service_context(
    logger: Any, method_name: str, event_dict: dict[str, Any]
) -> dict[str, Any]:  # noqa: ARG001
    event_dict.setdefault("service", settings.mcp_server_name)
    event_dict.setdefault("env", settings.environment)
    event_dict.setdefault("version", settings.mcp_server_version)
    return event_dict


def configure_logging() -> None:
    """Idempotent structured logging setup."""
    level_name = str(settings.log_level).upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(level=level, format="%(message)s", stream=sys.stderr, force=True)

    renderer = (
        structlog.processors.JSONRenderer()
        if settings.log_json
        else structlog.dev.ConsoleRenderer(colors=False)
    )
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            _add_service_context,
            _inject_trace_context,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog_redact_processor,
            renderer,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
