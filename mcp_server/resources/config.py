"""Configuration resources for MCP clients."""
from __future__ import annotations

from typing import Any

from agentic_ai.config.settings import settings

from ..diagnostics import get_feature_flags, get_limits_config, get_provider_configuration


def register_config_resources(mcp, runtime) -> None:
    @mcp.resource("config://pipeline")
    async def get_pipeline_config() -> dict[str, Any]:
        """Get key pipeline config values used by the server."""
        return {
            "service": settings.mcp_server_name,
            "version": settings.mcp_server_version,
            "max_iterations": settings.max_iterations,
            "agent_timeout": settings.agent_timeout,
            "default_provider": settings.default_llm_provider,
            "default_model": settings.default_model,
            "temperature": settings.temperature,
            "environment": settings.environment,
            "runtime_ready": runtime.ready,
        }

    @mcp.resource("config://limits")
    async def get_limits() -> dict[str, Any]:
        """Get runtime guardrails and processing limits."""
        return get_limits_config()

    @mcp.resource("config://providers")
    async def get_provider_config() -> dict[str, Any]:
        """Get provider readiness (boolean only, no secret values)."""
        return get_provider_configuration()

    @mcp.resource("config://features")
    async def get_features() -> dict[str, bool]:
        """Get feature flag toggles for this MCP deployment."""
        return get_feature_flags()
