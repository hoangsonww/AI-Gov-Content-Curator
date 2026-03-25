"""
Batch article processor for the SynthoraAI orchestration layer.

Provides concurrent article processing with an asyncio semaphore to
bound parallelism, priority-based ordering, per-item retry logic, and
a typed :class:`BatchResult` summary.
"""
from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

import structlog

from .supervisor import ContentSupervisor

logger = structlog.get_logger(__name__)

# Default concurrency ceiling for batch processing
_DEFAULT_CONCURRENCY: int = 5
# Default per-article retry limit
_DEFAULT_MAX_RETRIES: int = 2


def _utc_now() -> str:
    """Return the current UTC timestamp as ISO-8601."""
    return datetime.now(timezone.utc).isoformat()


@dataclass
class BatchResult:
    """Summary of a completed batch processing run.

    Args:
        batch_id: Unique identifier for this batch run.
        total: Total number of articles submitted.
        succeeded: Count of articles that completed without error.
        failed: Count of articles that exhausted all retry attempts.
        skipped: Count of articles skipped due to invalid payloads.
        results: Per-article result dictionaries.
        started_at: ISO-8601 start timestamp.
        completed_at: ISO-8601 completion timestamp.
        duration_seconds: Wall-clock time for the full batch.
    """

    batch_id: str
    total: int
    succeeded: int
    failed: int
    skipped: int
    results: list[dict[str, Any]] = field(default_factory=list)
    started_at: str = field(default_factory=_utc_now)
    completed_at: Optional[str] = None
    duration_seconds: float = 0.0


class ArticleBatchProcessor:
    """Concurrent batch processor backed by :class:`~agentic_ai.orchestration.supervisor.ContentSupervisor`.

    Articles are sorted by priority before processing.  A semaphore
    limits the number of concurrent pipeline invocations.  Failed
    articles are retried up to ``max_retries`` times using a fresh
    supervisor call.

    Example::

        processor = ArticleBatchProcessor(supervisor=supervisor, concurrency=3)
        result = await processor.process_batch(articles, mode="fast")

    Args:
        supervisor: The :class:`ContentSupervisor` to delegate individual
            article processing to.
        concurrency: Maximum number of articles processed simultaneously.
        max_retries: Maximum per-article retry attempts on failure.
    """

    def __init__(
        self,
        supervisor: ContentSupervisor,
        concurrency: int = _DEFAULT_CONCURRENCY,
        max_retries: int = _DEFAULT_MAX_RETRIES,
    ) -> None:
        self._supervisor = supervisor
        self._concurrency = concurrency
        self._max_retries = max_retries

    # ------------------------------------------------------------------
    # Primary entry points
    # ------------------------------------------------------------------

    async def process_batch(
        self,
        articles: list[dict[str, Any]],
        mode: str = "full",
        priority_key: str = "priority",
    ) -> BatchResult:
        """Process a list of articles concurrently.

        Articles are sorted in descending order by the integer value found at
        ``priority_key`` in each payload (higher numbers run first).  A
        missing key is treated as priority ``0``.

        Args:
            articles: List of article payload dictionaries.
            mode: Processing mode string forwarded to the supervisor.
            priority_key: Key within each article dict that holds the numeric
                priority.  Defaults to ``"priority"``.

        Returns:
            :class:`BatchResult` summarising outcomes.
        """
        batch_id = str(uuid.uuid4())
        started_at = _utc_now()
        t0 = asyncio.get_running_loop().time()

        log = logger.bind(batch_id=batch_id, total=len(articles), mode=mode)
        log.info("batch_processor.start")

        def _safe_priority(a: dict[str, Any]) -> int:
            try:
                return int(float(a.get(priority_key, 0)))
            except (ValueError, TypeError):
                return 0

        sorted_articles = sorted(articles, key=_safe_priority, reverse=True)

        semaphore = asyncio.Semaphore(self._concurrency)
        tasks = [
            self._process_one(article, mode, semaphore, batch_id)
            for article in sorted_articles
        ]
        item_results: list[dict[str, Any]] = await asyncio.gather(*tasks, return_exceptions=False)

        succeeded = sum(1 for r in item_results if r.get("status") == "completed")
        failed = sum(1 for r in item_results if r.get("status") == "failed")
        skipped = sum(1 for r in item_results if r.get("status") == "skipped")

        t1 = asyncio.get_running_loop().time()
        completed_at = _utc_now()
        duration = round(t1 - t0, 3)

        log.info(
            "batch_processor.complete",
            succeeded=succeeded,
            failed=failed,
            skipped=skipped,
            duration_seconds=duration,
        )

        return BatchResult(
            batch_id=batch_id,
            total=len(articles),
            succeeded=succeeded,
            failed=failed,
            skipped=skipped,
            results=item_results,
            started_at=started_at,
            completed_at=completed_at,
            duration_seconds=duration,
        )

    async def retry_failed(
        self,
        batch_result: BatchResult,
        mode: str = "full",
    ) -> BatchResult:
        """Re-process only the failed articles from a previous batch run.

        Args:
            batch_result: The :class:`BatchResult` from a prior
                :meth:`process_batch` call.
            mode: Processing mode for the retry run.

        Returns:
            A new :class:`BatchResult` for the retried subset.
        """
        failed_articles = [
            r["original_payload"]
            for r in batch_result.results
            if r.get("status") == "failed" and r.get("original_payload")
        ]

        if not failed_articles:
            logger.info("batch_processor.retry_no_failures", batch_id=batch_result.batch_id)
            return BatchResult(
                batch_id=str(uuid.uuid4()),
                total=0,
                succeeded=0,
                failed=0,
                skipped=0,
                completed_at=_utc_now(),
            )

        logger.info(
            "batch_processor.retry_start",
            original_batch_id=batch_result.batch_id,
            retry_count=len(failed_articles),
        )
        return await self.process_batch(failed_articles, mode=mode)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _process_one(
        self,
        article: dict[str, Any],
        mode: str,
        semaphore: asyncio.Semaphore,
        batch_id: str,
    ) -> dict[str, Any]:
        """Process a single article, retrying on failure.

        Args:
            article: Article payload dictionary.
            mode: Processing mode.
            semaphore: Concurrency limiter.
            batch_id: Parent batch identifier for log correlation.

        Returns:
            Per-article result dictionary with keys: ``article_id``, ``status``,
            ``result`` or ``error``, ``retries``, ``original_payload``.
        """
        article_id = str(
            article.get("id") or article.get("article_id") or uuid.uuid4()
        )

        if not article.get("content"):
            logger.warning(
                "batch_processor.skipped",
                batch_id=batch_id,
                article_id=article_id,
                reason="missing_content",
            )
            return {
                "article_id": article_id,
                "status": "skipped",
                "error": "missing_content",
                "retries": 0,
                "original_payload": article,
            }

        retries = 0
        last_error: Optional[str] = None

        async with semaphore:
            while retries <= self._max_retries:
                try:
                    result = await self._supervisor.process_article(article, mode=mode)
                    if result.get("error"):
                        raise RuntimeError(str(result["error"]))

                    logger.debug(
                        "batch_processor.item_complete",
                        batch_id=batch_id,
                        article_id=article_id,
                        retries=retries,
                    )
                    return {
                        "article_id": article_id,
                        "status": "completed",
                        "result": result,
                        "retries": retries,
                        "original_payload": article,
                    }
                except Exception as exc:
                    last_error = str(exc)
                    retries += 1
                    logger.warning(
                        "batch_processor.item_retry",
                        batch_id=batch_id,
                        article_id=article_id,
                        attempt=retries,
                        error=last_error,
                    )
                    if retries <= self._max_retries:
                        await asyncio.sleep(0.5 * retries)

        logger.error(
            "batch_processor.item_failed",
            batch_id=batch_id,
            article_id=article_id,
            retries=retries - 1,
            error=last_error,
        )
        return {
            "article_id": article_id,
            "status": "failed",
            "error": last_error,
            "retries": retries - 1,
            "original_payload": article,
        }
