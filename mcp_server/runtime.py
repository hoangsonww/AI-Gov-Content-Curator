"""
Runtime wiring for pipeline + job store.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

import structlog

from agentic_ai.config.settings import settings

from .job_store import ProcessingJobStore
from .utils import utc_now_iso

if TYPE_CHECKING:  # pragma: no cover - typing only
    from agentic_ai.core.pipeline import AgenticPipeline


class ServerRuntime:
    """
    Runtime container shared by MCP tools/resources.
    """

    def __init__(self) -> None:
        self.logger = structlog.get_logger("mcp_server.runtime")
        self.started_at = utc_now_iso()
        self.pipeline: "AgenticPipeline | None" = None
        self.ready = False
        self.startup_error: str | None = None

        try:
            from agentic_ai.core.pipeline import AgenticPipeline

            self.pipeline = AgenticPipeline()
            self.ready = True
        except Exception as exc:  # pragma: no cover - startup safety net
            self.startup_error = str(exc)
            self.logger.error("pipeline_initialization_failed", error=self.startup_error)

        self.jobs = ProcessingJobStore(
            max_history=settings.mcp_max_job_history,
            ttl_seconds=settings.mcp_job_ttl_seconds,
        )

    def readiness(self) -> dict[str, Any]:
        return {
            "ready": self.ready and self.pipeline is not None,
            "startup_error": self.startup_error,
            "started_at": self.started_at,
        }
