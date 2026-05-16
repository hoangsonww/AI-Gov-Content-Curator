"""Liveness vs readiness vs deep-health checks.

Three distinct concepts:

- **Liveness**: process is alive and event loop responsive. Fails → kill +
  restart pod. Should not fail because Redis is down.
- **Readiness**: ready to accept traffic. Fails → remove from load balancer
  but don't restart. Fails when Redis/ACP is required and unavailable.
- **Health (deep)**: comprehensive snapshot including component status,
  provider config, jobs stats, ACP stats. Suitable for /health endpoint
  consumed by humans or sophisticated probes.

The MCP server uses stdio transport so these are surfaced through MCP
tools (`check_pipeline_health`, `run_preflight_checks`) rather than HTTP.
"""

from __future__ import annotations

from typing import Any

import structlog

from agentic_ai.config.settings import settings

from .diagnostics import build_health_report
from .runtime import ServerRuntime
from .utils import utc_now_iso

logger = structlog.get_logger("mcp_server.health")


async def liveness(runtime: ServerRuntime) -> dict[str, Any]:
    """Cheap, always-fast probe. Confirms the loop and runtime object live."""
    return {
        "status": "alive",
        "timestamp": utc_now_iso(),
        "service": settings.mcp_server_name,
        "version": settings.mcp_server_version,
        "started_at": runtime.started_at,
    }


async def readiness(runtime: ServerRuntime) -> dict[str, Any]:
    """Confirm dependencies needed to accept work are reachable."""
    base = runtime.readiness()
    acp = await runtime.acp_preflight()
    ready = bool(base.get("ready")) and bool(acp.get("ready"))
    return {
        "status": "ready" if ready else "not_ready",
        "timestamp": utc_now_iso(),
        "service": settings.mcp_server_name,
        "ready": ready,
        "runtime": base,
        "acp": acp,
    }


async def health(runtime: ServerRuntime) -> dict[str, Any]:
    """Deep health report. Same payload as `check_pipeline_health` tool."""
    return await build_health_report(runtime)
