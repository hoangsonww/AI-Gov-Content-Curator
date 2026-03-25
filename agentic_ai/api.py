"""
FastAPI HTTP bridge for the AgenticPipeline.

Exposes the Python LangGraph article-processing pipeline over HTTP so that
the TypeScript orchestration layer (and any other service) can call it
without needing stdio/MCP.

Start:
    cd agentic_ai && uvicorn api:app --host 0.0.0.0 --port 8100
Or from repo root:
    PYTHONPATH=. python -m uvicorn agentic_ai.api:app --host 0.0.0.0 --port 8100
"""

from __future__ import annotations

import asyncio
import logging
import time
import traceback
from typing import Any, Dict, List, Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logger = logging.getLogger("agentic_ai.api")

# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class ArticlePayload(BaseModel):
    article_id: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1, max_length=50_000)
    url: Optional[str] = None
    source: Optional[str] = None
    title: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class ProcessRequest(BaseModel):
    article: ArticlePayload
    mode: Literal["full", "fast", "enrich", "reprocess"] = "full"


class AnalyzeRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=50_000)
    analysis_type: Literal[
        "content", "sentiment", "classification", "summary", "quality", "full"
    ] = "full"


class BatchRequest(BaseModel):
    articles: List[ArticlePayload] = Field(..., min_length=1, max_length=25)
    mode: Literal["full", "fast", "enrich", "reprocess"] = "full"
    continue_on_error: bool = True


class ProcessResult(BaseModel):
    article_id: str
    status: Literal["completed", "failed"]
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    duration_ms: float = 0


class HealthResponse(BaseModel):
    status: Literal["healthy", "degraded", "unhealthy"]
    pipeline_ready: bool
    startup_error: Optional[str] = None
    version: str = "1.0.0"


# ---------------------------------------------------------------------------
# Pipeline singleton (lazy-init)
# ---------------------------------------------------------------------------

_pipeline: Any = None
_pipeline_error: Optional[str] = None


def _get_pipeline():
    """Lazily import and instantiate the AgenticPipeline."""
    global _pipeline, _pipeline_error
    if _pipeline is not None:
        return _pipeline
    if _pipeline_error is not None:
        return None
    try:
        from agentic_ai.core.pipeline import AgenticPipeline

        _pipeline = AgenticPipeline()
        logger.info("AgenticPipeline initialized successfully")
        return _pipeline
    except Exception as exc:
        _pipeline_error = f"{type(exc).__name__}: {exc}"
        logger.error("Failed to initialize AgenticPipeline: %s", _pipeline_error)
        return None


def _require_pipeline():
    """Return the pipeline or raise 503."""
    p = _get_pipeline()
    if p is None:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Pipeline unavailable",
                "startup_error": _pipeline_error,
            },
        )
    return p


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="SynthoraAI Agentic Pipeline API",
    version="1.0.0",
    description="HTTP bridge for the Python LangGraph article-processing pipeline",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health", response_model=HealthResponse)
async def health():
    """Pipeline health check."""
    p = _get_pipeline()
    if p is not None:
        return HealthResponse(status="healthy", pipeline_ready=True)
    return HealthResponse(
        status="unhealthy",
        pipeline_ready=False,
        startup_error=_pipeline_error,
    )


@app.post("/process", response_model=ProcessResult)
async def process_article(req: ProcessRequest):
    """Process a single article through the full LangGraph pipeline."""
    pipeline = _require_pipeline()
    start = time.monotonic()
    try:
        article_data = {
            "id": req.article.article_id,
            "content": req.article.content,
            "url": req.article.url or "",
            "source": req.article.source or "",
            "title": req.article.title or "",
            **(req.article.metadata or {}),
        }
        result = await pipeline.process_article(article_data)
        duration = (time.monotonic() - start) * 1000
        return ProcessResult(
            article_id=req.article.article_id,
            status="completed",
            result=result,
            duration_ms=round(duration, 2),
        )
    except Exception as exc:
        duration = (time.monotonic() - start) * 1000
        logger.error("process_article failed: %s\n%s", exc, traceback.format_exc())
        return ProcessResult(
            article_id=req.article.article_id,
            status="failed",
            error=str(exc),
            duration_ms=round(duration, 2),
        )


@app.post("/analyze")
async def analyze_content(req: AnalyzeRequest):
    """Run individual analysis agents without the full pipeline."""
    pipeline = _require_pipeline()
    results: Dict[str, Any] = {}

    try:
        if req.analysis_type in ("content", "full"):
            results["content_analysis"] = await pipeline.content_analyzer.analyze(
                req.content, {}
            )

        if req.analysis_type in ("sentiment", "full"):
            results["sentiment"] = await pipeline.sentiment_analyzer.analyze_sentiment(
                req.content
            )

        if req.analysis_type in ("classification", "full"):
            results["classification"] = await pipeline.classifier.classify(req.content)

        if req.analysis_type in ("summary", "full"):
            results["summary"] = await pipeline.summarizer.summarize(req.content)

        if req.analysis_type in ("quality", "full"):
            summary = results.get("summary", "")
            topics = results.get("classification", [])
            sentiment = results.get("sentiment", {})
            results["quality"] = await pipeline.quality_checker.check_quality(
                req.content, summary, topics, sentiment
            )

        return {"status": "completed", "analysis_type": req.analysis_type, **results}
    except Exception as exc:
        logger.error("analyze_content failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/batch")
async def process_batch(req: BatchRequest):
    """Process multiple articles concurrently."""
    pipeline = _require_pipeline()
    start = time.monotonic()

    async def _process_one(article: ArticlePayload) -> ProcessResult:
        t0 = time.monotonic()
        try:
            article_data = {
                "id": article.article_id,
                "content": article.content,
                "url": article.url or "",
                "source": article.source or "",
                "title": article.title or "",
            }
            result = await pipeline.process_article(article_data)
            return ProcessResult(
                article_id=article.article_id,
                status="completed",
                result=result,
                duration_ms=round((time.monotonic() - t0) * 1000, 2),
            )
        except Exception as exc:
            if not req.continue_on_error:
                raise
            return ProcessResult(
                article_id=article.article_id,
                status="failed",
                error=str(exc),
                duration_ms=round((time.monotonic() - t0) * 1000, 2),
            )

    # Process with bounded concurrency (max 5 at a time)
    semaphore = asyncio.Semaphore(5)

    async def _guarded(article: ArticlePayload) -> ProcessResult:
        async with semaphore:
            return await _process_one(article)

    results = await asyncio.gather(*[_guarded(a) for a in req.articles])
    total_ms = round((time.monotonic() - start) * 1000, 2)

    succeeded = sum(1 for r in results if r.status == "completed")
    failed = sum(1 for r in results if r.status == "failed")

    return {
        "total": len(results),
        "succeeded": succeeded,
        "failed": failed,
        "duration_ms": total_ms,
        "results": [r.model_dump() for r in results],
    }
