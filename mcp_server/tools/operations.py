"""Operational and diagnostics MCP tools."""
from __future__ import annotations

from typing import Any

from agentic_ai.config.settings import settings

from ..diagnostics import (
    build_health_report,
    get_feature_flags,
    get_limits_config,
    get_provider_configuration,
    get_server_capabilities as get_server_capabilities_snapshot,
)
from ..runtime import ServerRuntime
from ..validation import validate_content_size
from .common import ensure_runtime_ready, validation_error


def register_operations_tools(mcp, runtime: ServerRuntime, logger) -> None:
    @mcp.tool()
    async def check_pipeline_health() -> dict[str, Any]:
        """Return runtime health status for the pipeline and job counts."""
        return await build_health_report(runtime)

    @mcp.tool()
    async def get_pipeline_graph(format: str = "mermaid") -> dict[str, Any]:
        """Return pipeline graph in Mermaid format for observability and reviews."""
        normalized = format.strip().lower()
        if normalized not in {"mermaid"}:
            return validation_error("format", "supported formats: mermaid")

        pipeline, readiness_error = ensure_runtime_ready(runtime)
        if readiness_error:
            return readiness_error

        graph = pipeline.visualize()
        return {
            "format": normalized,
            "graph": graph,
        }

    @mcp.tool()
    async def get_server_capabilities() -> dict[str, Any]:
        """Return complete MCP primitive inventory and runtime identity metadata."""
        return get_server_capabilities_snapshot()

    @mcp.tool()
    async def get_runtime_readiness() -> dict[str, Any]:
        """Return runtime readiness including startup failure context when degraded."""
        return runtime.readiness()

    @mcp.tool()
    async def diagnose_provider_configuration() -> dict[str, Any]:
        """Inspect model provider readiness without exposing raw secrets."""
        return get_provider_configuration()

    @mcp.tool()
    async def run_preflight_checks(sample_content: str = "") -> dict[str, Any]:
        """Run production readiness checks for limits, providers, and runtime prerequisites."""
        providers = get_provider_configuration()
        limits = get_limits_config()
        feature_flags = get_feature_flags()
        acp = await runtime.acp_preflight()

        checks = {
            "default_provider_configured": providers["default_provider_ready"],
            "any_provider_configured": bool(providers["configured_providers"]),
            "pipeline_compiled": runtime.ready and runtime.pipeline is not None and hasattr(runtime.pipeline, "app"),
            "job_store_available": hasattr(runtime, "jobs"),
            "limits_valid": limits["max_content_chars"] > 0 and limits["max_batch_items"] > 0,
            "acp_operational": acp["ready"],
        }

        sample_check: dict[str, Any] = {}
        if sample_content.strip():
            size_error = validate_content_size(sample_content)
            sample_check = {
                "content_chars": len(sample_content),
                "within_content_limit": size_error is None,
                "validation_error": size_error,
            }

        checks["ready"] = all(checks.values())

        logger.info(
            "tool.run_preflight_checks.complete",
            ready=checks["ready"],
            default_provider=settings.default_llm_provider,
        )

        return {
            "ready": checks["ready"],
            "checks": checks,
            "runtime": runtime.readiness(),
            "providers": providers,
            "limits": limits,
            "feature_flags": feature_flags,
            "acp": acp,
            "sample_content": sample_check,
        }
