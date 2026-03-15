from __future__ import annotations

import pytest

from mcp_server.job_store import ProcessingJobStore
from mcp_server.models import ProcessingStatus
from mcp_server.utils import utc_now_iso


@pytest.mark.asyncio
async def test_list_recent_supports_status_filter_and_offset() -> None:
    store = ProcessingJobStore(max_history=20, ttl_seconds=3600)

    await store.upsert(
        ProcessingStatus(
            article_id="a-1",
            status="completed",
            progress=1.0,
            started_at=utc_now_iso(),
            completed_at=utc_now_iso(),
        )
    )
    await store.upsert(
        ProcessingStatus(
            article_id="a-2",
            status="failed",
            progress=1.0,
            started_at=utc_now_iso(),
            completed_at=utc_now_iso(),
            error="failed",
        )
    )
    await store.upsert(
        ProcessingStatus(
            article_id="a-3",
            status="completed",
            progress=1.0,
            started_at=utc_now_iso(),
            completed_at=utc_now_iso(),
        )
    )

    completed_jobs = await store.list_recent(limit=10, status="completed", newest_first=True)
    assert [job["article_id"] for job in completed_jobs] == ["a-3", "a-1"]

    paged_jobs = await store.list_recent(limit=1, offset=1, status="completed", newest_first=True)
    assert [job["article_id"] for job in paged_jobs] == ["a-1"]


@pytest.mark.asyncio
async def test_purge_can_remove_by_status() -> None:
    store = ProcessingJobStore(max_history=20, ttl_seconds=3600)

    await store.upsert(
        ProcessingStatus(
            article_id="keep-processing",
            status="processing",
            progress=0.5,
            started_at=utc_now_iso(),
        )
    )
    await store.upsert(
        ProcessingStatus(
            article_id="drop-failed",
            status="failed",
            progress=1.0,
            started_at=utc_now_iso(),
            completed_at=utc_now_iso(),
            error="failed",
        )
    )

    result = await store.purge(status="failed")
    assert result["deleted"] == 1
    assert result["remaining"] == 1

    remaining = await store.list_recent(limit=10)
    assert [job["article_id"] for job in remaining] == ["keep-processing"]
