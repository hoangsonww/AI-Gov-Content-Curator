"""Tool-level middleware: tracing, metrics, validation, rate limiting.

Wraps every MCP tool with a uniform pipeline so we don't repeat boilerplate
in each tool implementation.
"""

from __future__ import annotations

import functools
import time
from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

import structlog

from agentic_ai.config.settings import settings

from .errors import MCPError, ResourceExhaustedError
from .observability import metrics, traced_async_span
from .security import TokenBucketRateLimiter

logger = structlog.get_logger("mcp_server.middleware")

T = TypeVar("T")
ToolFn = Callable[..., Awaitable[dict[str, Any]]]


_rate_limiter: TokenBucketRateLimiter | None = None


def _get_limiter() -> TokenBucketRateLimiter:
    global _rate_limiter  # noqa: PLW0603
    if _rate_limiter is None:
        _rate_limiter = TokenBucketRateLimiter(
            rate_per_sec=max(1.0, settings.rate_limit_requests / max(1, settings.rate_limit_window)),
            burst=max(1, settings.rate_limit_requests),
        )
    return _rate_limiter


def tool_middleware(
    name: str,
    *,
    rate_limit_key: str = "default",
    rate_limit: bool = True,
) -> Callable[[ToolFn], ToolFn]:
    """Wrap an MCP tool with span + metrics + optional rate limit.

    Tools should return a dict; uncaught `MCPError` subclasses are converted
    to error payloads. Bare exceptions are also converted but logged loudly
    so we never crash the FastMCP request loop.
    """

    def wrap(fn: ToolFn) -> ToolFn:
        @functools.wraps(fn)
        async def inner(*args: Any, **kwargs: Any) -> dict[str, Any]:
            m = metrics()
            start = time.monotonic()
            tool_logger = logger.bind(tool=name)

            if rate_limit:
                allowed = await _get_limiter().try_acquire(rate_limit_key)
                if not allowed:
                    m.mcp_tool_invocations_total.labels(tool=name, status="rate_limited").inc()
                    err = ResourceExhaustedError(
                        "Rate limit exceeded",
                        context={"tool": name, "key": rate_limit_key},
                    )
                    return err.to_dict()

            try:
                async with traced_async_span(f"mcp.tool.{name}", tool=name):
                    result = await fn(*args, **kwargs)
                m.mcp_tool_invocations_total.labels(tool=name, status="ok").inc()
                return result
            except MCPError as exc:
                tool_logger.warning(
                    "tool.error",
                    code=exc.code,
                    message=exc.message,
                    retryable=exc.retryable,
                )
                m.mcp_tool_invocations_total.labels(tool=name, status=exc.code).inc()
                return exc.to_dict()
            except Exception as exc:  # pragma: no cover - defensive
                tool_logger.exception("tool.unhandled_error", error=str(exc))
                m.mcp_tool_invocations_total.labels(tool=name, status="unhandled").inc()
                return {
                    "error": "internal_error",
                    "message": "An unexpected error occurred",
                    "retryable": False,
                }
            finally:
                duration = time.monotonic() - start
                m.mcp_tool_duration_seconds.labels(tool=name).observe(duration)

        return inner

    return wrap
