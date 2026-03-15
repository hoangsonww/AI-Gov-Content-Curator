"""Job and taxonomy resources."""
from __future__ import annotations

from typing import Any


def register_job_resources(mcp, runtime) -> None:
    @mcp.resource("jobs://stats")
    async def get_processing_stats() -> dict[str, Any]:
        """Get aggregate processing statistics."""
        return await runtime.jobs.stats()

    @mcp.resource("jobs://recent")
    async def get_recent_jobs() -> dict[str, Any]:
        """Get latest processing jobs (default short list)."""
        jobs = await runtime.jobs.list_recent(limit=20, offset=0, status=None, newest_first=True)
        return {
            "count": len(jobs),
            "jobs": jobs,
        }

    @mcp.resource("topics://available")
    async def get_available_topics() -> list[str]:
        """Get available classification categories."""
        if not runtime.ready or runtime.pipeline is None:
            return []
        return runtime.pipeline.classifier.TOPIC_CATEGORIES
