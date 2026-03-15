"""In-memory processing job store with retention guardrails."""
from __future__ import annotations

import asyncio
from collections import deque
from datetime import datetime, timedelta

from .models import ProcessingStatus
from .utils import utc_now


class ProcessingJobStore:
    """Async-safe in-memory job tracking with filtering and lifecycle controls."""

    def __init__(self, max_history: int, ttl_seconds: int):
        self.max_history = max_history
        self.ttl_seconds = ttl_seconds
        self._jobs: dict[str, ProcessingStatus] = {}
        self._order: deque[str] = deque()
        self._lock = asyncio.Lock()

    async def upsert(self, job: ProcessingStatus) -> None:
        async with self._lock:
            # Move updated jobs to the end so "recent" ordering reflects last activity.
            if job.article_id in self._jobs:
                try:
                    self._order.remove(job.article_id)
                except ValueError:
                    pass
            self._order.append(job.article_id)
            self._jobs[job.article_id] = job
            await self._prune_locked()

    async def get(self, article_id: str) -> ProcessingStatus | None:
        async with self._lock:
            return self._jobs.get(article_id)

    async def delete(self, article_id: str) -> bool:
        async with self._lock:
            existed = article_id in self._jobs
            if existed:
                self._jobs.pop(article_id, None)
                self._order = deque([job_id for job_id in self._order if job_id != article_id])
            return existed

    async def list_recent(
        self,
        limit: int,
        *,
        offset: int = 0,
        status: str | None = None,
        newest_first: bool = True,
    ) -> list[dict]:
        safe_limit = max(1, min(int(limit), 200))
        safe_offset = max(0, int(offset))
        async with self._lock:
            await self._prune_locked()

            ordered_ids = list(self._order)
            if newest_first:
                ordered_ids = list(reversed(ordered_ids))

            selected: list[dict] = []
            skipped = 0
            for job_id in ordered_ids:
                job = self._jobs.get(job_id)
                if job is None:
                    continue
                if status and job.status != status:
                    continue
                if skipped < safe_offset:
                    skipped += 1
                    continue
                selected.append(job.model_dump())
                if len(selected) >= safe_limit:
                    break

            return selected

    async def snapshot(self) -> list[ProcessingStatus]:
        async with self._lock:
            await self._prune_locked()
            return [self._jobs[job_id] for job_id in self._order if job_id in self._jobs]

    async def stats(self) -> dict[str, float]:
        jobs = await self.snapshot()
        total = len(jobs)
        completed = len([job for job in jobs if job.status == "completed"])
        failed = len([job for job in jobs if job.status == "failed"])
        processing = len([job for job in jobs if job.status == "processing"])
        pending = len([job for job in jobs if job.status == "pending"])
        return {
            "total_jobs": total,
            "completed": completed,
            "failed": failed,
            "processing": processing,
            "pending": pending,
            "success_rate": completed / total if total > 0 else 0.0,
        }

    async def purge(
        self,
        *,
        status: str | None = None,
        older_than_seconds: int | None = None,
    ) -> dict[str, int]:
        async with self._lock:
            await self._prune_locked()

            cutoff: datetime | None = None
            if older_than_seconds is not None:
                cutoff = utc_now() - timedelta(seconds=older_than_seconds)

            deleted = 0
            retained_ids: deque[str] = deque()
            for job_id in self._order:
                job = self._jobs.get(job_id)
                if job is None:
                    continue

                should_delete = True
                if status is not None and job.status != status:
                    should_delete = False

                if should_delete and cutoff is not None:
                    timestamp_text = job.completed_at or job.started_at
                    try:
                        ts = datetime.fromisoformat(timestamp_text)
                    except ValueError:
                        ts = utc_now()
                    if ts >= cutoff:
                        should_delete = False

                if should_delete:
                    self._jobs.pop(job_id, None)
                    deleted += 1
                else:
                    retained_ids.append(job_id)

            self._order = retained_ids
            return {
                "deleted": deleted,
                "remaining": len(self._jobs),
            }

    async def _prune_locked(self) -> None:
        ttl_cutoff = utc_now() - timedelta(seconds=self.ttl_seconds)

        stale_ids: set[str] = set()
        for article_id, job in self._jobs.items():
            if not job.completed_at:
                continue

            try:
                completed_at = datetime.fromisoformat(job.completed_at)
            except ValueError:
                completed_at = utc_now()

            if completed_at < ttl_cutoff:
                stale_ids.add(article_id)

        for article_id in stale_ids:
            self._jobs.pop(article_id, None)

        # Keep ordering consistent with existing jobs and enforce uniqueness.
        seen: set[str] = set()
        normalized_order: deque[str] = deque()
        for article_id in self._order:
            if article_id in seen:
                continue
            if article_id not in self._jobs:
                continue
            seen.add(article_id)
            normalized_order.append(article_id)

        while len(normalized_order) > self.max_history:
            stale_id = normalized_order.popleft()
            self._jobs.pop(stale_id, None)

        self._order = normalized_order
