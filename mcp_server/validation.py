"""Validation and sanitization helpers for MCP inputs.

Wraps `mcp_server.security` primitives so every MCP tool gets a uniform
set of input hygiene applied:

- Length caps from settings (content, metadata).
- Unicode NFKC normalization + control-char strip.
- Type coercion for metadata values.
"""

from __future__ import annotations

import json
from typing import Any

from agentic_ai.config.settings import settings

from .security import normalize_text, strip_control_chars


def validate_content_size(content: str) -> str | None:
    """Return an error message if content exceeds the configured cap."""
    if len(content) > settings.mcp_max_content_chars:
        return f"content exceeds max length ({settings.mcp_max_content_chars})"
    return None


def normalize_article_content(content: str) -> str:
    """Strip control chars and NFKC-normalize without truncating.

    Truncation is the caller's responsibility — the size validator above
    is informational.
    """
    return normalize_text(content)


def sanitize_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    """Bound + sanitize a metadata dict for safe persistence + logging.

    - Drops empty / non-string keys.
    - Coerces non-primitive values to JSON-stringified form.
    - Truncates oversized string values.
    - Strips control characters from string keys and values.
    - Rejects metadata that exceeds the configured key count.
    """
    if len(metadata) > settings.mcp_max_metadata_entries:
        raise ValueError(
            f"metadata has too many keys ({len(metadata)} > {settings.mcp_max_metadata_entries})"
        )

    sanitized: dict[str, Any] = {}
    for raw_key, raw_value in metadata.items():
        key = strip_control_chars(str(raw_key)).strip()
        if not key:
            continue

        if isinstance(raw_value, str | int | float | bool) or raw_value is None:
            value: Any = raw_value
        else:
            try:
                value = json.dumps(raw_value, default=str, ensure_ascii=False)
            except Exception:  # pragma: no cover - defensive
                value = str(raw_value)

        if isinstance(value, str):
            value = strip_control_chars(value)
            if len(value) > settings.mcp_max_metadata_value_chars:
                value = value[: settings.mcp_max_metadata_value_chars]

        sanitized[key] = value

    return sanitized
