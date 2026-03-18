"""Shared helpers for MCP tool modules."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import ValidationError

from agentic_ai.config.settings import settings

from ..models import ArticleProcessRequest
from ..runtime import ServerRuntime
from ..validation import sanitize_metadata, validate_content_size

_ALLOWED_JOB_STATUSES = {"pending", "processing", "completed", "failed", "not_found"}


def validation_error(field: str, message: str) -> dict[str, Any]:
    return {"error": "validation_error", "details": [{"field": field, "message": message}]}


def service_unavailable(message: str, runtime: ServerRuntime) -> dict[str, Any]:
    return {
        "error": "service_unavailable",
        "message": message,
        "readiness": runtime.readiness(),
    }


def ensure_runtime_ready(runtime: ServerRuntime) -> tuple[Any | None, dict[str, Any] | None]:
    if runtime.ready and runtime.pipeline is not None:
        return runtime.pipeline, None
    return None, service_unavailable(
        "pipeline runtime is not ready; verify model provider configuration and startup logs",
        runtime,
    )


def normalize_optional_status(raw_status: str) -> str | None:
    status = raw_status.strip().lower()
    if not status:
        return None
    if status not in _ALLOWED_JOB_STATUSES:
        raise ValueError(f"unsupported status '{raw_status}'")
    return status


def parse_article_request(
    article_id: str,
    content: str,
    url: str = "",
    source: str = "",
    metadata: Optional[dict[str, Any]] = None,
) -> tuple[ArticleProcessRequest | None, dict[str, Any] | None, dict[str, Any] | None]:
    try:
        request = ArticleProcessRequest(
            article_id=article_id,
            content=content,
            url=url,
            source=source,
            metadata=metadata or {},
        )
    except ValidationError as exc:
        return None, None, {"error": "validation_error", "details": exc.errors()}

    size_error = validate_content_size(request.content)
    if size_error:
        return None, None, validation_error("content", size_error)

    try:
        metadata_clean = sanitize_metadata(request.metadata)
    except ValueError as exc:
        return None, None, validation_error("metadata", str(exc))

    return request, metadata_clean, None


def validate_batch_size(requested_size: int) -> dict[str, Any] | None:
    if requested_size <= 0:
        return validation_error("articles", "at least one article is required")
    if requested_size > settings.mcp_max_batch_items:
        return validation_error(
            "articles",
            f"batch size exceeds max ({requested_size} > {settings.mcp_max_batch_items})",
        )
    return None


def coerce_positive_int(value: int, field_name: str, default: int, max_value: int) -> tuple[int, dict[str, Any] | None]:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default, validation_error(field_name, "must be an integer")

    if parsed < 0:
        return default, validation_error(field_name, "must be >= 0")

    if parsed > max_value:
        return default, validation_error(field_name, f"must be <= {max_value}")

    return parsed, None
