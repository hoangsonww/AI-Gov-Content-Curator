"""FastAPI HTTP bridge for the AgenticPipeline.

Exposes the Python LangGraph article-processing pipeline over HTTP so the
TypeScript orchestration layer (or any other consumer) can call it
without going through stdio/MCP.

Hardening:
- Structured logging via `configure_logging` (JSON, OTel trace correlation).
- OpenTelemetry tracing via `configure_observability`; FastAPI + HTTPX
  + Redis auto-instrumentation when the packages are present.
- Prometheus metrics exposed at `/metrics`.
- Three health endpoints: `/healthz` (liveness), `/readyz` (readiness),
  `/health` (deep health).
- Token-bucket rate limiting at the boundary, configurable via env.
- Structured error envelopes for MCPError; explicit 500 fallback.
- CORS allowlist configurable via `API_CORS_ALLOW_ORIGINS`.
- Trusted host middleware enabled when running behind a proxy.

Start:
    uvicorn agentic_ai.api:app --host 0.0.0.0 --port 8100
"""

from __future__ import annotations

import asyncio
import os
import time
from contextlib import asynccontextmanager
from typing import Any, Literal

import structlog
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel, Field
from starlette.middleware.base import BaseHTTPMiddleware

from agentic_ai.config.settings import settings
from mcp_server.errors import MCPError, ResourceExhaustedError, ValidationError
from mcp_server.logging_config import configure_logging
from mcp_server.observability import (
    configure_observability,
    metrics,
    metrics_text,
    traced_async_span,
)
from mcp_server.security import TokenBucketRateLimiter

# Boot side effects ----------------------------------------------------------

configure_logging()
configure_observability()
logger = structlog.get_logger("agentic_ai.api")


# ────────────────────────────────────────────────────────────────────────────
# Request / response models
# ────────────────────────────────────────────────────────────────────────────


class ArticlePayload(BaseModel):
    article_id: str = Field(..., min_length=1, max_length=128)
    content: str = Field(..., min_length=1, max_length=settings.mcp_max_content_chars)
    url: str | None = Field(default=None, max_length=2048)
    source: str | None = Field(default=None, max_length=256)
    title: str | None = Field(default=None, max_length=512)
    metadata: dict[str, Any] | None = None


class ProcessRequest(BaseModel):
    article: ArticlePayload
    mode: Literal["full", "fast", "enrich", "reprocess"] = "full"


class AnalyzeRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=settings.mcp_max_content_chars)
    analysis_type: Literal[
        "content", "sentiment", "classification", "summary", "quality", "full"
    ] = "full"


class BatchRequest(BaseModel):
    articles: list[ArticlePayload] = Field(
        ..., min_length=1, max_length=settings.mcp_max_batch_items
    )
    mode: Literal["full", "fast", "enrich", "reprocess"] = "full"
    continue_on_error: bool = True


class ProcessResult(BaseModel):
    article_id: str
    status: Literal["completed", "failed"]
    result: dict[str, Any] | None = None
    error: str | None = None
    duration_ms: float = 0


class HealthResponse(BaseModel):
    status: Literal["healthy", "degraded", "unhealthy", "alive", "ready", "not_ready"]
    pipeline_ready: bool = False
    startup_error: str | None = None
    version: str = settings.app_version


# ────────────────────────────────────────────────────────────────────────────
# Pipeline singleton (lazy-init)
# ────────────────────────────────────────────────────────────────────────────

_pipeline: Any = None
_pipeline_error: str | None = None


def _get_pipeline() -> Any:
    global _pipeline, _pipeline_error
    if _pipeline is not None:
        return _pipeline
    if _pipeline_error is not None:
        return None
    try:
        from agentic_ai.core.pipeline import AgenticPipeline

        _pipeline = AgenticPipeline()
        logger.info("api.pipeline.initialized")
        return _pipeline
    except Exception as exc:
        _pipeline_error = f"{type(exc).__name__}: {exc}"
        logger.error("api.pipeline.init_failed", error=_pipeline_error)
        return None


def _require_pipeline() -> Any:
    p = _get_pipeline()
    if p is None:
        raise HTTPException(
            status_code=503,
            detail={"error": "pipeline_unavailable", "startup_error": _pipeline_error},
        )
    return p


# ────────────────────────────────────────────────────────────────────────────
# Lifespan
# ────────────────────────────────────────────────────────────────────────────


@asynccontextmanager
async def _lifespan(app: FastAPI) -> Any:
    logger.info("api.starting", version=settings.app_version, environment=settings.environment)
    # Trigger instrumentation that needs the FastAPI app instance.
    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

        FastAPIInstrumentor.instrument_app(app, excluded_urls="/healthz,/readyz,/metrics")
    except Exception:  # pragma: no cover - optional dep
        pass
    try:
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

        HTTPXClientInstrumentor().instrument()
    except Exception:  # pragma: no cover
        pass
    try:
        from opentelemetry.instrumentation.logging import LoggingInstrumentor

        LoggingInstrumentor().instrument(set_logging_format=False)
    except Exception:  # pragma: no cover
        pass
    yield
    logger.info("api.stopping")


# ────────────────────────────────────────────────────────────────────────────
# Middlewares
# ────────────────────────────────────────────────────────────────────────────


class _RateLimitMiddleware(BaseHTTPMiddleware):
    """Token-bucket rate limit keyed by client IP. Skip for health/metrics."""

    _SKIP_PATHS = frozenset({"/healthz", "/readyz", "/metrics", "/health"})

    def __init__(self, app: Any) -> None:
        super().__init__(app)
        rate = max(1.0, settings.rate_limit_requests / max(1, settings.rate_limit_window))
        self._limiter = TokenBucketRateLimiter(
            rate_per_sec=rate,
            burst=max(1, settings.rate_limit_requests),
        )

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        path = request.url.path
        if path in self._SKIP_PATHS:
            return await call_next(request)
        client = request.client.host if request.client else "unknown"
        if not await self._limiter.try_acquire(client):
            err = ResourceExhaustedError(
                "Rate limit exceeded",
                context={"path": path},
            )
            metrics().mcp_tool_invocations_total.labels(tool="http", status="rate_limited").inc()
            return JSONResponse(err.to_dict(), status_code=err.http_status)
        return await call_next(request)


class _AccessLogMiddleware(BaseHTTPMiddleware):
    """Per-request span + structured access log + duration metric."""

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        start = time.monotonic()
        path = request.url.path
        async with traced_async_span(
            f"http.{request.method.lower()}",
            **{
                "http.method": request.method,
                "http.route": path,
                "http.client_ip": request.client.host if request.client else "unknown",
            },
        ):
            response = await call_next(request)
        duration_s = time.monotonic() - start
        status = str(response.status_code)
        logger.info(
            "http.access",
            method=request.method,
            path=path,
            status=int(status),
            duration_ms=int(duration_s * 1000),
        )
        metrics().mcp_tool_duration_seconds.labels(tool=f"http:{path}").observe(duration_s)
        metrics().mcp_tool_invocations_total.labels(
            tool=f"http:{path}", status=status[0] + "xx"
        ).inc()
        return response


# ────────────────────────────────────────────────────────────────────────────
# App
# ────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="SynthoraAI Agentic Pipeline API",
    version=settings.app_version,
    description="HTTP bridge for the Python LangGraph article-processing pipeline.",
    docs_url="/docs" if not settings.is_production() else None,
    redoc_url="/redoc" if not settings.is_production() else None,
    openapi_url="/openapi.json" if not settings.is_production() else None,
    lifespan=_lifespan,
)


def _cors_origins() -> list[str]:
    raw = os.environ.get("API_CORS_ALLOW_ORIGINS", "")
    if not raw.strip():
        return ["*"] if not settings.is_production() else []
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _trusted_hosts() -> list[str]:
    raw = os.environ.get("API_TRUSTED_HOSTS", "")
    if not raw.strip():
        return ["*"]
    return [h.strip() for h in raw.split(",") if h.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
    allow_credentials=False,
    max_age=600,
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=_trusted_hosts())
app.add_middleware(_RateLimitMiddleware)
app.add_middleware(_AccessLogMiddleware)


# ────────────────────────────────────────────────────────────────────────────
# Error handlers
# ────────────────────────────────────────────────────────────────────────────


@app.exception_handler(MCPError)
async def _mcp_error_handler(_: Request, exc: MCPError) -> JSONResponse:
    metrics().errors_total.labels(code=exc.code).inc()
    return JSONResponse(exc.to_dict(), status_code=exc.http_status)


@app.exception_handler(Exception)
async def _unhandled_handler(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("api.unhandled_error", error=str(exc), error_type=type(exc).__name__)
    metrics().errors_total.labels(code="unhandled").inc()
    return JSONResponse(
        {"error": "internal_error", "message": "An unexpected error occurred"},
        status_code=500,
    )


# ────────────────────────────────────────────────────────────────────────────
# Health + observability
# ────────────────────────────────────────────────────────────────────────────


@app.get("/healthz", response_model=HealthResponse, tags=["health"])
async def liveness() -> HealthResponse:
    """Cheap liveness probe — process up + module importable."""
    return HealthResponse(status="alive", pipeline_ready=_pipeline is not None)


@app.get("/readyz", response_model=HealthResponse, tags=["health"])
async def readiness() -> HealthResponse:
    """Readiness — pipeline initialized."""
    ready = _get_pipeline() is not None
    return HealthResponse(
        status="ready" if ready else "not_ready",
        pipeline_ready=ready,
        startup_error=_pipeline_error,
    )


@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health() -> HealthResponse:
    """Deep health (mirrors /readyz for HTTP surface)."""
    return await readiness()


@app.get("/metrics", include_in_schema=False)
async def metrics_endpoint() -> Response:
    return PlainTextResponse(metrics_text(), media_type="text/plain; version=0.0.4")


# ────────────────────────────────────────────────────────────────────────────
# Pipeline routes
# ────────────────────────────────────────────────────────────────────────────


@app.post("/process", response_model=ProcessResult, tags=["pipeline"])
async def process_article(req: ProcessRequest) -> ProcessResult:
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
        async with traced_async_span(
            "api.process_article",
            **{"article.id": req.article.article_id, "mode": req.mode},
        ):
            result = await pipeline.process_article(article_data)
        return ProcessResult(
            article_id=req.article.article_id,
            status="completed",
            result=result,
            duration_ms=round((time.monotonic() - start) * 1000, 2),
        )
    except MCPError:
        raise
    except Exception as exc:
        logger.exception("api.process_article.failed", article_id=req.article.article_id)
        return ProcessResult(
            article_id=req.article.article_id,
            status="failed",
            error=f"{type(exc).__name__}: {exc}",
            duration_ms=round((time.monotonic() - start) * 1000, 2),
        )


@app.post("/analyze", tags=["pipeline"])
async def analyze_content(req: AnalyzeRequest) -> dict[str, Any]:
    pipeline = _require_pipeline()
    results: dict[str, Any] = {}
    try:
        async with traced_async_span("api.analyze", **{"analysis.type": req.analysis_type}):
            if req.analysis_type in ("content", "full"):
                results["content_analysis"] = await asyncio.to_thread(
                    pipeline.content_analyzer.analyze, req.content, {}
                )
            if req.analysis_type in ("sentiment", "full"):
                results["sentiment"] = await asyncio.to_thread(
                    pipeline.sentiment_analyzer.analyze_sentiment, req.content
                )
            if req.analysis_type in ("classification", "full"):
                results["classification"] = await asyncio.to_thread(
                    pipeline.classifier.classify, req.content
                )
            if req.analysis_type in ("summary", "full"):
                results["summary"] = await asyncio.to_thread(
                    pipeline.summarizer.summarize, req.content
                )
            if req.analysis_type in ("quality", "full"):
                summary = results.get("summary", "")
                topics = results.get("classification", [])
                sentiment = results.get("sentiment", {})
                results["quality"] = await asyncio.to_thread(
                    pipeline.quality_checker.check_quality,
                    req.content,
                    summary,
                    topics,
                    sentiment,
                )
        return {"status": "completed", "analysis_type": req.analysis_type, **results}
    except MCPError:
        raise
    except Exception as exc:
        logger.exception("api.analyze.failed", analysis_type=req.analysis_type)
        raise HTTPException(status_code=500, detail=f"{type(exc).__name__}: {exc}") from exc


@app.post("/batch", tags=["pipeline"])
async def process_batch(req: BatchRequest) -> dict[str, Any]:
    if len(req.articles) > settings.mcp_max_batch_items:
        raise ValidationError(
            f"batch size {len(req.articles)} exceeds {settings.mcp_max_batch_items}"
        )
    pipeline = _require_pipeline()
    start = time.monotonic()

    semaphore = asyncio.Semaphore(min(5, len(req.articles)))

    async def _one(article: ArticlePayload) -> ProcessResult:
        t0 = time.monotonic()
        async with semaphore:
            try:
                result = await pipeline.process_article(
                    {
                        "id": article.article_id,
                        "content": article.content,
                        "url": article.url or "",
                        "source": article.source or "",
                        "title": article.title or "",
                    }
                )
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
                    error=f"{type(exc).__name__}: {exc}",
                    duration_ms=round((time.monotonic() - t0) * 1000, 2),
                )

    async with traced_async_span("api.batch", **{"batch.size": len(req.articles)}):
        results = await asyncio.gather(*[_one(a) for a in req.articles])

    succeeded = sum(1 for r in results if r.status == "completed")
    failed = sum(1 for r in results if r.status == "failed")
    return {
        "total": len(results),
        "succeeded": succeeded,
        "failed": failed,
        "duration_ms": round((time.monotonic() - start) * 1000, 2),
        "results": [r.model_dump() for r in results],
    }
