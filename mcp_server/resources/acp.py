"""ACP resources for operational visibility."""
from __future__ import annotations

from typing import Any

from agentic_ai.config.settings import settings


def register_acp_resources(mcp, runtime) -> None:
    @mcp.resource("acp://agents")
    async def acp_agents() -> dict[str, Any]:
        """Get registered ACP agents."""
        if not settings.acp_enabled:
            return {"enabled": False, "count": 0, "agents": []}
        agents = await runtime.acp.list_agents()
        return {"enabled": True, "count": len(agents), "agents": agents}

    @mcp.resource("acp://stats")
    async def acp_stats() -> dict[str, Any]:
        """Get ACP message and registry stats."""
        if not settings.acp_enabled:
            return {"enabled": False, "registered_agents": 0, "total_messages": 0}
        return {"enabled": True, **(await runtime.acp.stats())}

    @mcp.resource("acp://messages/recent")
    async def acp_recent_messages() -> dict[str, Any]:
        """Get recent ACP message envelopes."""
        if not settings.acp_enabled:
            return {"enabled": False, "count": 0, "messages": []}
        messages = await runtime.acp.list_recent_messages(limit=20, offset=0)
        return {"enabled": True, "count": len(messages), "messages": messages}

