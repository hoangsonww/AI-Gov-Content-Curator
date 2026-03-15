"""Shared diagnostics helpers for tools and resources."""
from __future__ import annotations

from typing import Any

from agentic_ai.config.settings import settings

from .catalog import PROMPT_CATALOG, RESOURCE_CATALOG, TOOL_CATALOG
from .runtime import ServerRuntime
from .utils import utc_now_iso


def get_limits_config() -> dict[str, Any]:
    return {
        "max_content_chars": settings.mcp_max_content_chars,
        "max_metadata_entries": settings.mcp_max_metadata_entries,
        "max_metadata_value_chars": settings.mcp_max_metadata_value_chars,
        "max_job_history": settings.mcp_max_job_history,
        "job_ttl_seconds": settings.mcp_job_ttl_seconds,
        "max_batch_items": settings.mcp_max_batch_items,
        "max_iterations": settings.max_iterations,
        "agent_timeout_seconds": settings.agent_timeout,
    }


def get_provider_configuration() -> dict[str, Any]:
    providers = {
        "google": bool(settings.google_ai_api_key),
        "openai": bool(settings.openai_api_key),
        "anthropic": bool(settings.anthropic_api_key),
        "cohere": bool(settings.cohere_api_key),
    }
    configured = [name for name, ready in providers.items() if ready]
    return {
        "default_provider": settings.default_llm_provider,
        "default_model": settings.default_model,
        "temperature": settings.temperature,
        "configured_providers": configured,
        "provider_readiness": providers,
        "default_provider_ready": providers.get(settings.default_llm_provider, False),
    }


def get_feature_flags() -> dict[str, bool]:
    return {
        "content_analysis": settings.enable_content_analysis,
        "sentiment_analysis": settings.enable_sentiment_analysis,
        "summarization": settings.enable_summarization,
        "classification": settings.enable_classification,
        "human_in_loop": settings.enable_human_in_loop,
        "metrics": settings.enable_metrics,
    }


def get_server_capabilities() -> dict[str, Any]:
    return {
        "service": settings.mcp_server_name,
        "version": settings.mcp_server_version,
        "environment": settings.environment,
        "tools": TOOL_CATALOG,
        "resources": RESOURCE_CATALOG,
        "prompts": PROMPT_CATALOG,
    }


def get_pipeline_component_status(runtime: ServerRuntime) -> dict[str, bool]:
    pipeline = runtime.pipeline
    if pipeline is None:
        return {
            "content_analyzer": False,
            "summarizer": False,
            "classifier": False,
            "sentiment_analyzer": False,
            "quality_checker": False,
            "graph_app": False,
        }

    return {
        "content_analyzer": hasattr(pipeline, "content_analyzer"),
        "summarizer": hasattr(pipeline, "summarizer"),
        "classifier": hasattr(pipeline, "classifier"),
        "sentiment_analyzer": hasattr(pipeline, "sentiment_analyzer"),
        "quality_checker": hasattr(pipeline, "quality_checker"),
        "graph_app": hasattr(pipeline, "app"),
    }


async def build_health_report(runtime: ServerRuntime) -> dict[str, Any]:
    stats = await runtime.jobs.stats()
    component_status = get_pipeline_component_status(runtime)
    provider_configuration = get_provider_configuration()

    is_operational = runtime.ready and all(component_status.values())

    return {
        "status": "healthy" if is_operational else "degraded",
        "timestamp": utc_now_iso(),
        "service": settings.mcp_server_name,
        "version": settings.mcp_server_version,
        "environment": settings.environment,
        "runtime": runtime.readiness(),
        "pipeline": {
            "operational": is_operational,
            "components": component_status,
        },
        "jobs": {
            "active": stats["processing"],
            "completed": stats["completed"],
            "failed": stats["failed"],
            "total": stats["total_jobs"],
            "success_rate": stats["success_rate"],
        },
        "providers": provider_configuration,
        "limits": get_limits_config(),
        "features": get_feature_flags(),
    }
