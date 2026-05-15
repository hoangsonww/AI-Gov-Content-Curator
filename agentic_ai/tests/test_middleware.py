"""Tests for the tool middleware decorator."""

from __future__ import annotations

import pytest

from mcp_server.errors import ValidationError
from mcp_server.middleware import tool_middleware


pytestmark = pytest.mark.asyncio


async def test_middleware_passes_result_through(
    fresh_metrics_registry,  # noqa: ARG001
) -> None:
    @tool_middleware("ok", rate_limit=False)
    async def ok_tool() -> dict[str, str]:
        return {"status": "ok"}

    assert await ok_tool() == {"status": "ok"}


async def test_middleware_converts_mcp_error_to_dict(
    fresh_metrics_registry,  # noqa: ARG001
) -> None:
    @tool_middleware("bad", rate_limit=False)
    async def bad_tool() -> dict[str, str]:
        raise ValidationError("missing field", context={"field": "x"})

    result = await bad_tool()
    assert result["error"] == "validation_error"
    assert result["message"] == "missing field"
    assert result["retryable"] is False


async def test_middleware_handles_unhandled_exception(
    fresh_metrics_registry,  # noqa: ARG001
) -> None:
    @tool_middleware("explode", rate_limit=False)
    async def exploder() -> dict[str, str]:
        raise RuntimeError("kaboom")

    result = await exploder()
    assert result["error"] == "internal_error"
    assert result["retryable"] is False
