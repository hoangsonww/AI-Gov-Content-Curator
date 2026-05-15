"""Google Cloud Functions handler for the Agentic AI Pipeline.

Hardened in line with the AWS Lambda + Azure adapter:
- Configures structured logging + OTel + Prometheus on cold start.
- Validates input through `mcp_server.validation`.
- Maps `MCPError` to typed HTTP responses.
- Persists results to GCS when `GCP_STORAGE_BUCKET` is set.

Entrypoints:
- `process_article` — HTTP trigger; expects JSON body.
- `process_pubsub`  — Cloud Pub/Sub trigger; payload is base64 JSON.

Deploy with the Functions Framework (Python 3.11 runtime):

    gcloud functions deploy synthora-process-article \\
        --runtime=python311 --entry-point=process_article \\
        --trigger-http --allow-unauthenticated  # tighten in prod

The Functions Framework is part of the cloud-gcp requirements extras.
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
from typing import Any

import structlog

from agentic_ai.config.settings import settings
from agentic_ai.core.pipeline import AgenticPipeline
from mcp_server.errors import MCPError, ValidationError
from mcp_server.logging_config import configure_logging
from mcp_server.observability import configure_observability, metrics, traced_async_span
from mcp_server.validation import sanitize_metadata, validate_content_size

configure_logging()
configure_observability()
logger = structlog.get_logger("agentic_ai.gcp.cloud_function")

_pipeline: AgenticPipeline | None = None
_loop: asyncio.AbstractEventLoop | None = None


def _get_pipeline() -> AgenticPipeline:
    global _pipeline
    if _pipeline is None:
        logger.info("gcp.cold_start")
        _pipeline = AgenticPipeline()
    return _pipeline


def _get_loop() -> asyncio.AbstractEventLoop:
    global _loop
    if _loop is None or _loop.is_closed():
        _loop = asyncio.new_event_loop()
    return _loop


def _validate(payload: dict[str, Any]) -> None:
    article_id = payload.get("article_id")
    content = payload.get("content")
    if not isinstance(article_id, str) or not article_id.strip():
        raise ValidationError("article_id is required")
    if not isinstance(content, str) or not content.strip():
        raise ValidationError("content is required")
    err = validate_content_size(content)
    if err:
        raise ValidationError(err)


def _normalize(body: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": body["article_id"].strip(),
        "content": body["content"],
        "url": str(body.get("url", "")).strip(),
        "source": str(body.get("source", "")).strip(),
        **sanitize_metadata(body.get("metadata") or {}),
    }


def _persist_result(result: dict[str, Any], article_id: str) -> None:
    bucket = os.getenv("GCP_STORAGE_BUCKET") or settings.gcp_storage_bucket
    if not bucket:
        return
    try:
        from google.cloud import storage  # type: ignore[import-not-found]

        client = storage.Client()
        blob = client.bucket(bucket).blob(f"results/{article_id}.json")
        blob.upload_from_string(
            json.dumps(result, default=str),
            content_type="application/json",
        )
    except Exception as exc:  # pragma: no cover
        logger.warning("gcp.gcs.upload_failed", article_id=article_id, error=str(exc))


def process_article(request: Any) -> tuple[str, int, dict[str, str]]:
    """HTTP trigger entrypoint (Functions Framework)."""
    log = logger.bind(environment=settings.environment)
    headers = {"Content-Type": "application/json", "Cache-Control": "no-store"}
    try:
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            raise ValidationError("Request body must be a JSON object")
        _validate(body)
        article_data = _normalize(body)

        async def _run() -> Any:
            async with traced_async_span(
                "gcp.process_article",
                **{"article.id": article_data["id"]},
            ):
                return await _get_pipeline().process_article(article_data)

        result = _get_loop().run_until_complete(_run())
        log.info("gcp.complete", article_id=article_data["id"])
        return json.dumps(result, default=str), 200, headers

    except MCPError as exc:
        log.warning("gcp.error", code=exc.code, message=exc.message)
        metrics().errors_total.labels(code=exc.code).inc()
        return json.dumps(exc.to_dict()), exc.http_status, headers
    except Exception as exc:  # pragma: no cover
        log.exception("gcp.unhandled")
        metrics().errors_total.labels(code="unhandled").inc()
        return (
            json.dumps({"error": "internal_error", "message": str(exc)}),
            500,
            headers,
        )


def process_pubsub(event: dict[str, Any], context: Any) -> None:
    """Pub/Sub trigger entrypoint. `event["data"]` is base64-encoded JSON."""
    log = logger.bind(environment=settings.environment)
    try:
        raw = base64.b64decode(event.get("data", "")).decode("utf-8")
        body = json.loads(raw)
        _validate(body)
        article_data = _normalize(body)

        async def _run() -> Any:
            async with traced_async_span(
                "gcp.process_pubsub",
                **{"article.id": article_data["id"]},
            ):
                return await _get_pipeline().process_article(article_data)

        result = _get_loop().run_until_complete(_run())
        _persist_result(result, article_data["id"])
        log.info("gcp.pubsub.complete", article_id=article_data["id"])

    except MCPError as exc:
        log.warning("gcp.pubsub.error", code=exc.code, message=exc.message)
        metrics().errors_total.labels(code=exc.code).inc()
        raise
    except Exception:
        log.exception("gcp.pubsub.unhandled")
        metrics().errors_total.labels(code="unhandled").inc()
        raise
