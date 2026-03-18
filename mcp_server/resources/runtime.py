"""Runtime resources for operational visibility."""
from __future__ import annotations

from typing import Any

from ..diagnostics import build_health_report, get_server_capabilities


def register_runtime_resources(mcp, runtime) -> None:
    @mcp.resource("runtime://health")
    async def runtime_health() -> dict[str, Any]:
        """Get runtime health report for monitoring dashboards."""
        return await build_health_report(runtime)

    @mcp.resource("runtime://readiness")
    async def runtime_readiness() -> dict[str, Any]:
        """Get startup readiness state for this MCP runtime."""
        return runtime.readiness()

    @mcp.resource("runtime://capabilities")
    async def runtime_capabilities() -> dict[str, Any]:
        """Get MCP capability inventory (tools/resources/prompts)."""
        return get_server_capabilities()

    @mcp.resource("runtime://pipeline/graph")
    async def pipeline_graph() -> dict[str, Any]:
        """Get pipeline graph representation for diagnostics."""
        if not runtime.ready or runtime.pipeline is None:
            return {
                "format": "mermaid",
                "error": "service_unavailable",
                "readiness": runtime.readiness(),
            }
        return {
            "format": "mermaid",
            "graph": runtime.pipeline.visualize(),
        }
