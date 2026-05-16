"""Smoke tests for typed errors."""

from __future__ import annotations

from mcp_server.errors import (
    RETRYABLE_ERROR_TYPES,
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


def test_to_dict_shape() -> None:
    err = ValidationError("bad", context={"field": "x"})
    out = err.to_dict()
    assert out == {
        "error": "validation_error",
        "message": "bad",
        "context": {"field": "x"},
        "retryable": False,
    }


def test_retryable_classification() -> None:
    assert TransientUpstreamError("x").retryable is True
    assert ResourceExhaustedError("x").retryable is True
    assert CircuitOpenError("x").retryable is True
    assert TimeoutError_("x").retryable is True
    assert ValidationError("x").retryable is False
    assert PermanentUpstreamError("x").retryable is False
    assert AuthorizationError("x").retryable is False
    assert NotFoundError("x").retryable is False
    assert ConflictError("x").retryable is False
    assert ConfigurationError("x").retryable is False


def test_subclass_of_mcp_error() -> None:
    for cls in (
        ValidationError,
        AuthorizationError,
        NotFoundError,
        ConflictError,
        ResourceExhaustedError,
        UpstreamError,
        TransientUpstreamError,
        PermanentUpstreamError,
        TimeoutError_,
        CircuitOpenError,
        ConfigurationError,
    ):
        assert issubclass(cls, MCPError)


def test_retryable_error_types_membership() -> None:
    assert TransientUpstreamError in RETRYABLE_ERROR_TYPES
    assert ResourceExhaustedError in RETRYABLE_ERROR_TYPES
    assert TimeoutError_ in RETRYABLE_ERROR_TYPES
