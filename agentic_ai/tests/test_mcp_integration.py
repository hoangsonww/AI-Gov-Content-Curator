"""Integration tests for MCP server composition.

These boot the real `AgenticMCPServer` (with the pipeline degraded — no
LLM key in the test env) and exercise tool registration + invocation
through FastMCP's tool manager. This covers the wiring in `app.py`,
`tools/`, `resources/`, and `prompts/` that unit tests cannot reach.
"""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio


@pytest.fixture
def mcp_server(fresh_metrics_registry, reset_circuit_breakers):
    from mcp_server.app import create_server

    return create_server()


def _tool_map(server: object) -> dict[str, object]:
    manager = server.mcp._tool_manager
    return {t.name: t for t in manager.list_tools()}


async def test_server_registers_expected_tools(mcp_server: object) -> None:
    tools = _tool_map(mcp_server)
    # A representative slice across all four tool modules.
    for name in (
        "process_article",
        "process_article_batch",
        "validate_article_payload",
        "analyze_content",
        "evaluate_quality",
        "check_pipeline_health",
        "get_runtime_readiness",
        "acp_register_agent",
        "acp_send_message",
    ):
        assert name in tools, f"missing tool: {name}"


async def test_process_article_schema_preserved(mcp_server: object) -> None:
    """Middleware must not erase the typed signature FastMCP needs."""
    tool = _tool_map(mcp_server)["process_article"]
    props = set(tool.parameters.get("properties", {}))
    assert {"article_id", "content", "url", "source", "metadata"} <= props
    assert set(tool.parameters.get("required", [])) == {"article_id", "content"}


async def test_validate_article_payload_runs(mcp_server: object) -> None:
    """A pure-validation tool works even with the pipeline degraded."""
    manager = mcp_server.mcp._tool_manager
    result = await manager.call_tool(
        "validate_article_payload",
        {"article_id": "a1", "content": "Government policy update on infrastructure."},
    )
    payload = result if isinstance(result, dict) else getattr(result, "content", result)
    assert payload is not None


async def test_check_pipeline_health_runs(mcp_server: object) -> None:
    manager = mcp_server.mcp._tool_manager
    result = await manager.call_tool("check_pipeline_health", {})
    assert result is not None


async def test_runtime_readiness_reports_degraded_without_key(mcp_server: object) -> None:
    """In the test env there is no LLM key, so the pipeline is degraded."""
    readiness = mcp_server.runtime.readiness()
    assert readiness["ready"] is False
    assert readiness["startup_error"]


async def test_resources_and_prompts_registered(mcp_server: object) -> None:
    # Resource + prompt managers should be populated.
    resource_mgr = mcp_server.mcp._resource_manager
    prompt_mgr = mcp_server.mcp._prompt_manager
    assert list(resource_mgr.list_resources()) or list(
        getattr(resource_mgr, "list_templates", list)()
    )
    assert list(prompt_mgr.list_prompts())
