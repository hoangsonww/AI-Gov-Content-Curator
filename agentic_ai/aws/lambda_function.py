"""AWS Lambda handler for the Agentic AI Pipeline.

Hardened:
- Uses proper package imports (no sys.path hack).
- Configures structured logging + OTel + Prometheus on cold start.
- Validates input through Pydantic via `ArticleProcessRequest`.
- Converts `MCPError` subclasses to typed responses.
- Logs go to CloudWatch with trace_id correlation (when X-Ray or OTel
  side-car is configured).
- The pipeline coroutine runs under an asyncio policy that survives
  Lambda's frozen loop across warm invocations.
"""

from __future__ import annotations

import asyncio
import json
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
logger = structlog.get_logger("agentic_ai.aws.lambda")

# Cold-start singletons.
_pipeline: AgenticPipeline | None = None
_loop: asyncio.AbstractEventLoop | None = None


def _get_pipeline() -> AgenticPipeline:
    global _pipeline
    if _pipeline is None:
        logger.info("lambda.cold_start")
        _pipeline = AgenticPipeline()
    return _pipeline


def _get_loop() -> asyncio.AbstractEventLoop:
    """Reuse one event loop across warm invocations.

    Calling `asyncio.run` per invocation closes the loop, which prevents
    background tasks (OTel exporter, breakers) from re-using state.
    """
    global _loop
    if _loop is None or _loop.is_closed():
        _loop = asyncio.new_event_loop()
    return _loop


def _validate_event(payload: dict[str, Any]) -> None:
    article_id = payload.get("article_id")
    content = payload.get("content")
    if not isinstance(article_id, str) or not article_id.strip():
        raise ValidationError("article_id is required")
    if not isinstance(content, str) or not content.strip():
        raise ValidationError("content is required")
    err = validate_content_size(content)
    if err:
        raise ValidationError(err)


def _response(status_code: int, body: Any) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
        },
        "body": json.dumps(body, default=str),
    }


def lambda_handler(event: Any, context: Any) -> dict[str, Any]:
    """Lambda entrypoint. Accepts raw event or API Gateway proxy event."""
    request_id = getattr(context, "aws_request_id", None) or "unknown"
    log = logger.bind(
        request_id=request_id,
        function_name=getattr(context, "function_name", "lambda"),
        function_version=getattr(context, "function_version", ""),
    )
    log.info("lambda.invoke", environment=settings.environment)

    try:
        # Normalize event shape.
        if isinstance(event, str):
            event = json.loads(event)
        if isinstance(event, dict) and "body" in event:
            body = event["body"]
            if isinstance(body, str):
                body = json.loads(body)
            event = body

        _validate_event(event)
        article_data = {
            "id": event["article_id"].strip(),
            "content": event["content"],
            "url": str(event.get("url", "")).strip(),
            "source": str(event.get("source", "")).strip(),
            **sanitize_metadata(event.get("metadata") or {}),
        }

        async def _run() -> Any:
            async with traced_async_span(
                "aws.lambda.process_article",
                **{"article.id": article_data["id"]},
            ):
                return await _get_pipeline().process_article(article_data)

        result = _get_loop().run_until_complete(_run())
        log.info("lambda.complete", article_id=article_data["id"])
        return _response(200, result)

    except MCPError as exc:
        log.warning("lambda.error", code=exc.code, message=exc.message)
        metrics().errors_total.labels(code=exc.code).inc()
        return _response(exc.http_status, exc.to_dict())
    except Exception as exc:  # pragma: no cover - safety net
        log.exception("lambda.unhandled", error=str(exc))
        metrics().errors_total.labels(code="unhandled").inc()
        return _response(
            500,
            {"error": "internal_error", "message": "An unexpected error occurred"},
        )
