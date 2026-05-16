"""Typed exceptions for the MCP server and agentic pipeline.

These replace bare `Exception` usage in caller-facing code so callers can
discriminate transient/permanent failures and so retry decorators know
which classes are retryable.
"""

from __future__ import annotations

from typing import Any


class MCPError(Exception):
    """Base exception for all MCP server errors."""

    code: str = "mcp_error"
    http_status: int = 500
    retryable: bool = False

    def __init__(self, message: str, *, context: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.context = context or {}

    def to_dict(self) -> dict[str, Any]:
        return {
            "error": self.code,
            "message": self.message,
            "context": self.context,
            "retryable": self.retryable,
        }


class ValidationError(MCPError):
    """Input failed validation. Never retryable."""

    code = "validation_error"
    http_status = 400
    retryable = False


class AuthorizationError(MCPError):
    """Caller lacks permission for the requested operation."""

    code = "authorization_error"
    http_status = 403
    retryable = False


class NotFoundError(MCPError):
    """Requested resource does not exist."""

    code = "not_found"
    http_status = 404
    retryable = False


class ConflictError(MCPError):
    """Operation conflicts with current state."""

    code = "conflict"
    http_status = 409
    retryable = False


class ResourceExhaustedError(MCPError):
    """Quota, rate limit, or capacity exhausted."""

    code = "resource_exhausted"
    http_status = 429
    retryable = True


class UpstreamError(MCPError):
    """A downstream provider call failed.

    Subclasses indicate whether to retry. Use `TransientUpstreamError` for
    timeouts and 5xx; `PermanentUpstreamError` for invalid payload / 4xx
    that retrying will not fix.
    """

    code = "upstream_error"
    http_status = 502
    retryable = True


class TransientUpstreamError(UpstreamError):
    """Upstream failure likely to recover on retry."""

    code = "transient_upstream_error"
    http_status = 503
    retryable = True


class PermanentUpstreamError(UpstreamError):
    """Upstream failure that will not recover by retrying."""

    code = "permanent_upstream_error"
    http_status = 502
    retryable = False


class TimeoutError_(MCPError):
    """Operation exceeded its deadline."""

    code = "timeout"
    http_status = 504
    retryable = True


class CircuitOpenError(MCPError):
    """Circuit breaker is open. Caller should back off."""

    code = "circuit_open"
    http_status = 503
    retryable = True


class ConfigurationError(MCPError):
    """Server is misconfigured."""

    code = "configuration_error"
    http_status = 500
    retryable = False


RETRYABLE_ERROR_TYPES: tuple[type[BaseException], ...] = (
    TransientUpstreamError,
    ResourceExhaustedError,
    TimeoutError_,
    ConnectionError,
    TimeoutError,
)
