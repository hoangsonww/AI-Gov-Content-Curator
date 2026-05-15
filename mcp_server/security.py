"""Security primitives for the MCP server.

Provides:
- Secret redaction processor for structlog so we never leak API keys or
  tokens to stderr / aggregated logs.
- Input sanitization helpers (URL/string normalization, control-char strip).
- Constant-time comparison utilities.
- Simple token-bucket rate limiter for use by tools that need per-caller
  throttling beyond what the transport provides.
"""

from __future__ import annotations

import asyncio
import hmac
import re
import time
import unicodedata
from collections import defaultdict
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from typing import Any

# ─── Secret redaction ──────────────────────────────────────────────────────

# Field-name patterns that should have values redacted. Case-insensitive.
_SECRET_KEY_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?i)(api[_-]?key|secret|password|passwd|token|authorization|bearer)"),
    re.compile(r"(?i)(client[_-]?secret|private[_-]?key|access[_-]?key)"),
    re.compile(r"(?i)(deletion[_-]?token|reset[_-]?token|verification[_-]?token)"),
    re.compile(r"(?i)(session[_-]?id|csrf|cookie)"),
)

# Inline patterns: values that look like secrets even when key name doesn't.
_INLINE_SECRET_PATTERNS: tuple[re.Pattern[str], ...] = (
    # Provider-style prefixes.
    re.compile(r"\bsk-[A-Za-z0-9]{16,}\b"),  # OpenAI-style
    re.compile(r"\bsk-ant-[A-Za-z0-9_-]{16,}\b"),  # Anthropic
    re.compile(r"\bAIza[0-9A-Za-z_-]{20,}\b"),  # Google AI
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),  # AWS access key id
    re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b"),  # Slack
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b"),  # GitHub
    # JWT-shaped.
    re.compile(r"\beyJ[A-Za-z0-9_-]+?\.[A-Za-z0-9_-]+?\.[A-Za-z0-9_-]+\b"),
    # Bearer auth header value.
    re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._\-=]+"),
)

REDACTED = "***REDACTED***"


def _is_secret_key(key: Any) -> bool:
    if not isinstance(key, str):
        return False
    return any(pat.search(key) for pat in _SECRET_KEY_PATTERNS)


def _redact_obj(value: Any, *, key_is_secret: bool = False) -> Any:
    """Recursively redact secrets.

    - When `key_is_secret`, the whole value is masked (unless empty).
    - Strings have inline secret patterns scrubbed.
    - Mappings recurse with per-key secret detection so a secret-shaped
      key nested arbitrarily deep is still caught.
    - Lists / tuples recurse element-wise.
    """
    if key_is_secret:
        if value in (None, ""):
            return value
        return REDACTED

    if isinstance(value, str):
        out = value
        for pat in _INLINE_SECRET_PATTERNS:
            out = pat.sub(REDACTED, out)
        return out

    if isinstance(value, Mapping):
        return {k: _redact_obj(v, key_is_secret=_is_secret_key(k)) for k, v in value.items()}

    if isinstance(value, list | tuple):
        cls = type(value)
        return cls(_redact_obj(v) for v in value)

    return value


def redact_mapping(data: Mapping[str, Any]) -> dict[str, Any]:
    """Return a copy of `data` with secret-shaped keys and values masked.

    Redaction is recursive: secret-shaped keys are caught at any nesting
    depth, including inside lists of mappings.
    """
    return {k: _redact_obj(v, key_is_secret=_is_secret_key(k)) for k, v in data.items()}


def structlog_redact_processor(
    logger: Any, method_name: str, event_dict: dict[str, Any]
) -> dict[str, Any]:
    """structlog processor: redact secrets from every log record."""
    return redact_mapping(event_dict)


# ─── Input sanitization ───────────────────────────────────────────────────

# C0 control chars except whitespace tabs/newlines.
_CONTROL_CHARS = "".join(chr(c) for c in range(0x20) if c not in (0x09, 0x0A, 0x0D)) + "\x7f"
_CONTROL_RE = re.compile(f"[{re.escape(_CONTROL_CHARS)}]")


def strip_control_chars(value: str) -> str:
    """Remove ASCII control characters (preserving \\t \\n \\r)."""
    return _CONTROL_RE.sub("", value)


def normalize_text(value: str, *, max_length: int | None = None) -> str:
    """Normalize unicode, strip control chars, optionally truncate."""
    normalized = unicodedata.normalize("NFKC", value)
    normalized = strip_control_chars(normalized).strip()
    if max_length is not None and len(normalized) > max_length:
        normalized = normalized[:max_length]
    return normalized


_SAFE_ID_RE = re.compile(r"[^A-Za-z0-9._:\-]")


def safe_identifier(value: str, *, max_length: int = 128) -> str:
    """Conservatively normalize an external-supplied identifier.

    Strips control chars + characters that aren't `[A-Za-z0-9._:-]`.
    Used for IDs that may be embedded in log lines, span attributes,
    or metric labels — none of which tolerate arbitrary unicode well.
    """
    cleaned = strip_control_chars(value).strip()
    cleaned = _SAFE_ID_RE.sub("_", cleaned)
    return cleaned[:max_length]


def constant_time_equals(a: str, b: str) -> bool:
    """Constant-time string comparison.

    Wraps `hmac.compare_digest` for callers that want a single helper.
    """
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


# ─── Token-bucket rate limiter ────────────────────────────────────────────


@dataclass
class _Bucket:
    tokens: float
    last_refill: float


class TokenBucketRateLimiter:
    """Async-safe in-process token bucket keyed by string.

    Not distributed. For multi-replica use, swap with a Redis-backed limiter.
    Adequate for stdio MCP transport (single process).
    """

    def __init__(self, *, rate_per_sec: float, burst: int) -> None:
        if rate_per_sec <= 0:
            raise ValueError("rate_per_sec must be > 0")
        if burst <= 0:
            raise ValueError("burst must be > 0")
        self.rate_per_sec = float(rate_per_sec)
        self.burst = int(burst)
        self._buckets: dict[str, _Bucket] = defaultdict(
            lambda: _Bucket(tokens=float(self.burst), last_refill=time.monotonic())
        )
        self._lock = asyncio.Lock()

    async def try_acquire(self, key: str, tokens: float = 1.0) -> bool:
        async with self._lock:
            bucket = self._buckets[key]
            now = time.monotonic()
            elapsed = now - bucket.last_refill
            bucket.tokens = min(self.burst, bucket.tokens + elapsed * self.rate_per_sec)
            bucket.last_refill = now
            if bucket.tokens >= tokens:
                bucket.tokens -= tokens
                return True
            return False

    async def reset(self, key: str | None = None) -> None:
        async with self._lock:
            if key is None:
                self._buckets.clear()
            else:
                self._buckets.pop(key, None)


# ─── Allow-list helpers ───────────────────────────────────────────────────


def assert_in_allowlist(value: str, allow: Iterable[str], *, field: str) -> str:
    """Raise ValueError if `value` is not in `allow`."""
    allow_set = {str(v).strip().lower() for v in allow}
    if value.strip().lower() not in allow_set:
        raise ValueError(f"{field} '{value}' not allowed. Permitted: {sorted(allow_set)}")
    return value
