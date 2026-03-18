"""
Validation and sanitization helpers for MCP inputs.
"""
from __future__ import annotations

import json
from typing import Any

from agentic_ai.config.settings import settings


def validate_content_size(content: str) -> str | None:
    if len(content) > settings.mcp_max_content_chars:
        return f"content exceeds max length ({settings.mcp_max_content_chars})"
    return None


def sanitize_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    if len(metadata) > settings.mcp_max_metadata_entries:
        raise ValueError(
            f"metadata has too many keys ({len(metadata)} > {settings.mcp_max_metadata_entries})"
        )

    sanitized: dict[str, Any] = {}
    for raw_key, raw_value in metadata.items():
        key = str(raw_key).strip()
        if not key:
            continue

        if isinstance(raw_value, (str, int, float, bool)) or raw_value is None:
            value: Any = raw_value
        else:
            value = json.dumps(raw_value, default=str)

        if isinstance(value, str) and len(value) > settings.mcp_max_metadata_value_chars:
            value = value[: settings.mcp_max_metadata_value_chars]

        sanitized[key] = value

    return sanitized
