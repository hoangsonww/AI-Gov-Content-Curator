"""Azure Functions handlers for the Agentic AI Pipeline.

Hardened:
- Proper package imports.
- Structured logging + OTel + Prometheus configured at module load.
- Uses Pydantic-backed validation via shared helpers.
- Maps MCPError subclasses to typed HTTP responses.
- Single reused event loop across warm starts.
- Blob persistence uses managed identity when AZURE_STORAGE_KEY is
  absent (DefaultAzureCredential).
"""

from __future__ import annotations

import asyncio
import json
import os
from typing import Any

import azure.functions as func
import structlog

from agentic_ai.config.settings import settings
from agentic_ai.core.pipeline import AgenticPipeline
from mcp_server.errors import MCPError, ValidationError
from mcp_server.logging_config import configure_logging
from mcp_server.observability import configure_observability, metrics, traced_async_span
from mcp_server.validation import sanitize_metadata, validate_content_size

configure_logging()
configure_observability()
logger = structlog.get_logger("agentic_ai.azure.function")

_pipeline: AgenticPipeline | None = None
_loop: asyncio.AbstractEventLoop | None = None


def _get_pipeline() -> AgenticPipeline:
    global _pipeline  # noqa: PLW0603
    if _pipeline is None:
        logger.info("azure.cold_start")
        _pipeline = AgenticPipeline()
    return _pipeline


def _get_loop() -> asyncio.AbstractEventLoop:
    global _loop  # noqa: PLW0603
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


def _normalized_payload(body: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": body["article_id"].strip(),
        "content": body["content"],
        "url": str(body.get("url", "")).strip(),
        "source": str(body.get("source", "")).strip(),
        **sanitize_metadata(body.get("metadata") or {}),
    }


def _http_response(status_code: int, body: Any) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps(body, default=str),
        status_code=status_code,
        mimetype="application/json",
        headers={"Cache-Control": "no-store"},
    )


def _store_processing_result(result: dict[str, Any], article_id: str) -> None:
    """Persist queue results to Blob Storage.

    Prefer managed identity. Fall back to connection string only when the
    setting is present.
    """
    container = os.getenv("AZURE_RESULTS_CONTAINER", "agentic-results")
    account_url = os.getenv("AZURE_STORAGE_ACCOUNT_URL")
    connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")

    try:
        from azure.storage.blob import BlobServiceClient
        if account_url:
            from azure.identity import DefaultAzureCredential
            blob_service = BlobServiceClient(
                account_url=account_url,
                credential=DefaultAzureCredential(),
            )
        elif connection_string:
            blob_service = BlobServiceClient.from_connection_string(connection_string)
        else:
            logger.warning("azure.blob.skipped", reason="no_credentials")
            return
    except Exception as exc:  # pragma: no cover
        logger.warning("azure.blob.client_init_failed", error=str(exc))
        return

    try:
        container_client = blob_service.get_container_client(container)
        try:
            container_client.create_container()
        except Exception:
            pass
        blob_name = f"results/{article_id}.json"
        payload = json.dumps(result, default=str).encode("utf-8")
        container_client.get_blob_client(blob_name).upload_blob(payload, overwrite=True)
    except Exception as exc:  # pragma: no cover
        logger.warning("azure.blob.upload_failed", article_id=article_id, error=str(exc))


def main(req: func.HttpRequest) -> func.HttpResponse:
    """HTTP trigger entrypoint."""
    log = logger.bind(environment=settings.environment, invocation_id=req.headers.get("x-azure-functionkey", ""))
    try:
        try:
            body = req.get_json()
        except ValueError:
            raise ValidationError("Invalid JSON in request body")

        _validate(body)
        article_data = _normalized_payload(body)

        async def _run() -> Any:
            async with traced_async_span(
                "azure.function.process_article",
                **{"article.id": article_data["id"]},
            ):
                return await _get_pipeline().process_article(article_data)

        result = _get_loop().run_until_complete(_run())
        log.info("azure.function.complete", article_id=article_data["id"])
        return _http_response(200, result)

    except MCPError as exc:
        log.warning("azure.function.error", code=exc.code, message=exc.message)
        metrics().errors_total.labels(code=exc.code).inc()
        return _http_response(exc.http_status, exc.to_dict())
    except Exception as exc:  # pragma: no cover
        log.exception("azure.function.unhandled")
        metrics().errors_total.labels(code="unhandled").inc()
        return _http_response(
            500,
            {"error": "internal_error", "message": str(exc)},
        )


def queue_process(msg: func.QueueMessage) -> None:
    """Queue trigger entrypoint."""
    log = logger.bind(message_id=msg.id)
    try:
        body = json.loads(msg.get_body().decode("utf-8"))
        _validate(body)
        article_data = _normalized_payload(body)

        async def _run() -> Any:
            async with traced_async_span(
                "azure.function.queue_process",
                **{"article.id": article_data["id"]},
            ):
                return await _get_pipeline().process_article(article_data)

        result = _get_loop().run_until_complete(_run())
        _store_processing_result(result, article_data["id"])
        log.info("azure.queue.complete", article_id=article_data["id"])

    except MCPError as exc:
        log.warning("azure.queue.error", code=exc.code, message=exc.message)
        metrics().errors_total.labels(code=exc.code).inc()
        raise
    except Exception:
        log.exception("azure.queue.unhandled")
        metrics().errors_total.labels(code="unhandled").inc()
        # Re-raise so Azure moves to poison queue after retries.
        raise
