"""Processing and job lifecycle tools."""
from __future__ import annotations

from typing import Any

from ..models import ArticleProcessRequest, ProcessingStatus
from ..runtime import ServerRuntime
from ..utils import utc_now_iso
from .common import (
    coerce_positive_int,
    ensure_runtime_ready,
    normalize_optional_status,
    parse_article_request,
    validate_batch_size,
    validation_error,
)


def register_processing_tools(mcp, runtime: ServerRuntime, logger) -> None:
    async def _run_pipeline(request: ArticleProcessRequest, metadata_clean: dict[str, Any]) -> dict[str, Any]:
        pipeline, readiness_error = ensure_runtime_ready(runtime)
        if readiness_error:
            failed_job = ProcessingStatus(
                article_id=request.article_id,
                status="failed",
                progress=0.0,
                current_stage="runtime_unavailable",
                started_at=utc_now_iso(),
                completed_at=utc_now_iso(),
                error=readiness_error["message"],
            )
            await runtime.jobs.upsert(failed_job)
            return {"article_id": request.article_id, **readiness_error}

        logger.info("tool.process_article.start", article_id=request.article_id)
        job = ProcessingStatus(
            article_id=request.article_id,
            status="processing",
            progress=0.0,
            started_at=utc_now_iso(),
            current_stage="pipeline_execution",
        )
        await runtime.jobs.upsert(job)

        try:
            article_data: dict[str, Any] = {
                "id": request.article_id,
                "content": request.content,
                "url": request.url,
                "source": request.source,
                **metadata_clean,
            }
            result = await pipeline.process_article(article_data)
            job.status = "completed"
            job.progress = 1.0
            job.current_stage = "completed"
            job.completed_at = utc_now_iso()
            job.result = result
            await runtime.jobs.upsert(job)
            logger.info("tool.process_article.complete", article_id=request.article_id)
            return result
        except Exception:  # pragma: no cover - defensive path
            logger.exception("tool.process_article.failed", article_id=request.article_id)
            job.status = "failed"
            job.error = "processing_failed"
            job.current_stage = "failed"
            job.completed_at = utc_now_iso()
            await runtime.jobs.upsert(job)
            return {"article_id": request.article_id, "error": "processing_failed"}

    @mcp.tool()
    async def process_article(
        article_id: str,
        content: str,
        url: str = "",
        source: str = "",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Process a single article through the full LangGraph pipeline."""
        request, metadata_clean, error = parse_article_request(
            article_id=article_id,
            content=content,
            url=url,
            source=source,
            metadata=metadata,
        )
        if error:
            return error
        assert request is not None and metadata_clean is not None
        return await _run_pipeline(request, metadata_clean)

    @mcp.tool()
    async def process_article_batch(
        articles: list[dict[str, Any]],
        continue_on_error: bool = True,
    ) -> dict[str, Any]:
        """Process multiple articles with bounded batch controls and per-item results."""
        size_error = validate_batch_size(len(articles))
        if size_error:
            return size_error

        results: list[dict[str, Any]] = []
        succeeded = 0
        failed = 0

        for idx, payload in enumerate(articles):
            if not isinstance(payload, dict):
                failed += 1
                results.append(
                    {
                        "index": idx,
                        "article_id": None,
                        "status": "failed",
                        "error": validation_error("articles", "each item must be an object"),
                    }
                )
                if not continue_on_error:
                    break
                continue

            request, metadata_clean, error = parse_article_request(
                article_id=payload.get("article_id", ""),
                content=payload.get("content", ""),
                url=payload.get("url", ""),
                source=payload.get("source", ""),
                metadata=payload.get("metadata", {}),
            )

            if error:
                failed += 1
                results.append(
                    {
                        "index": idx,
                        "article_id": str(payload.get("article_id", "")).strip() or None,
                        "status": "failed",
                        "error": error,
                    }
                )
                if not continue_on_error:
                    break
                continue

            assert request is not None and metadata_clean is not None
            output = await _run_pipeline(request, metadata_clean)

            if output.get("error"):
                failed += 1
                results.append(
                    {
                        "index": idx,
                        "article_id": request.article_id,
                        "status": "failed",
                        "result": output,
                    }
                )
                if not continue_on_error:
                    break
            else:
                succeeded += 1
                results.append(
                    {
                        "index": idx,
                        "article_id": request.article_id,
                        "status": "completed",
                        "result": output,
                    }
                )

        return {
            "batch_size": len(articles),
            "processed": len(results),
            "succeeded": succeeded,
            "failed": failed,
            "stopped_early": len(results) < len(articles),
            "results": results,
        }

    @mcp.tool()
    async def validate_article_payload(
        article_id: str,
        content: str,
        url: str = "",
        source: str = "",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Validate and normalize article payload without executing the pipeline."""
        request, metadata_clean, error = parse_article_request(
            article_id=article_id,
            content=content,
            url=url,
            source=source,
            metadata=metadata,
        )
        if error:
            return error

        assert request is not None and metadata_clean is not None
        return {
            "valid": True,
            "normalized": {
                "article_id": request.article_id,
                "url": request.url,
                "source": request.source,
                "metadata": metadata_clean,
            },
            "stats": {
                "content_chars": len(request.content),
                "metadata_keys": len(metadata_clean),
            },
        }

    @mcp.tool()
    async def get_processing_status(article_id: str) -> dict[str, Any]:
        """Get current status for an article processing job."""
        normalized_id = str(article_id).strip()
        if not normalized_id:
            return validation_error("article_id", "required")

        job = await runtime.jobs.get(normalized_id)
        if job is None:
            return ProcessingStatus(
                article_id=normalized_id,
                status="not_found",
                progress=0.0,
                started_at=utc_now_iso(),
            ).model_dump()
        return job.model_dump()

    @mcp.tool()
    async def get_processing_result(article_id: str) -> dict[str, Any]:
        """Get finalized result payload for an article job when available."""
        normalized_id = str(article_id).strip()
        if not normalized_id:
            return validation_error("article_id", "required")

        job = await runtime.jobs.get(normalized_id)
        if job is None:
            return {"article_id": normalized_id, "status": "not_found"}

        return {
            "article_id": job.article_id,
            "status": job.status,
            "completed_at": job.completed_at,
            "error": job.error,
            "result": job.result,
        }

    @mcp.tool()
    async def list_processing_jobs(
        limit: int = 20,
        offset: int = 0,
        status: str = "",
        newest_first: bool = True,
    ) -> dict[str, Any]:
        """List processing jobs with status filters and pagination controls."""
        safe_limit, limit_error = coerce_positive_int(limit, "limit", 20, 200)
        if limit_error:
            return limit_error

        safe_offset, offset_error = coerce_positive_int(offset, "offset", 0, 10000)
        if offset_error:
            return offset_error

        try:
            normalized_status = normalize_optional_status(status)
        except ValueError as exc:
            return validation_error("status", str(exc))

        jobs = await runtime.jobs.list_recent(
            limit=safe_limit,
            offset=safe_offset,
            status=normalized_status,
            newest_first=newest_first,
        )

        return {
            "count": len(jobs),
            "limit": safe_limit,
            "offset": safe_offset,
            "status_filter": normalized_status,
            "jobs": jobs,
        }

    @mcp.tool()
    async def delete_processing_job(article_id: str) -> dict[str, Any]:
        """Delete a specific processing job from in-memory store."""
        normalized_id = str(article_id).strip()
        if not normalized_id:
            return validation_error("article_id", "required")

        deleted = await runtime.jobs.delete(normalized_id)
        return {
            "article_id": normalized_id,
            "deleted": deleted,
        }

    @mcp.tool()
    async def purge_processing_jobs(
        status: str = "",
        older_than_seconds: int = 0,
        confirm: bool = False,
    ) -> dict[str, Any]:
        """Purge jobs by optional status and age thresholds."""
        try:
            normalized_status = normalize_optional_status(status)
        except ValueError as exc:
            return validation_error("status", str(exc))

        safe_older_than, older_error = coerce_positive_int(
            older_than_seconds,
            "older_than_seconds",
            0,
            10_000_000,
        )
        if older_error:
            return older_error

        if normalized_status is None and safe_older_than == 0 and not confirm:
            return validation_error(
                "confirm",
                "set confirm=true to purge all jobs without filters",
            )

        result = await runtime.jobs.purge(
            status=normalized_status,
            older_than_seconds=safe_older_than if safe_older_than > 0 else None,
        )
        return result
