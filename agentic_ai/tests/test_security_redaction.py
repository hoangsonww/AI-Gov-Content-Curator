"""Tests for secret redaction + sanitization helpers."""

from __future__ import annotations

import pytest

from mcp_server.security import (
    REDACTED,
    TokenBucketRateLimiter,
    assert_in_allowlist,
    constant_time_equals,
    normalize_text,
    redact_mapping,
    safe_identifier,
    strip_control_chars,
    structlog_redact_processor,
)


class TestRedactMapping:
    def test_redacts_known_secret_keys(self) -> None:
        out = redact_mapping(
            {
                "username": "alice",
                "api_key": "sk-abcdef1234567890",
                "password": "p4ssw0rd",
                "Bearer": "token-value",
                "deletion_token": "tok123",
            }
        )
        assert out["username"] == "alice"
        assert out["api_key"] == REDACTED
        assert out["password"] == REDACTED
        assert out["Bearer"] == REDACTED
        assert out["deletion_token"] == REDACTED

    def test_redacts_inline_secret_patterns_in_values(self) -> None:
        out = redact_mapping(
            {
                "message": "user provided sk-ABCDEFG1234567890abcdef as test",
                "headers": {"Authorization": "Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature"},
            }
        )
        assert "sk-" not in out["message"]
        assert REDACTED in out["message"]
        assert out["headers"]["Authorization"] == REDACTED

    def test_recurses_into_lists(self) -> None:
        out = redact_mapping({"events": [{"api_key": "x"}, {"safe": "ok"}]})
        assert out["events"][0]["api_key"] == REDACTED
        assert out["events"][1]["safe"] == "ok"

    def test_preserves_empty_secret_values(self) -> None:
        out = redact_mapping({"api_key": ""})
        # Empty values stay empty — we redact presence, not absence.
        assert out["api_key"] == ""

    def test_does_not_mutate_input(self) -> None:
        original = {"api_key": "secret"}
        copy = dict(original)
        redact_mapping(original)
        assert original == copy


class TestStructlogProcessor:
    def test_processor_returns_redacted_event_dict(self) -> None:
        event = {"event": "log", "openai_api_key": "sk-12345678901234567890"}
        result = structlog_redact_processor(None, "info", event)
        assert result["openai_api_key"] == REDACTED


class TestSanitization:
    def test_strip_control_chars(self) -> None:
        assert strip_control_chars("hello\x00world\x7f!") == "helloworld!"
        assert strip_control_chars("keep\ttab\nnewline\rcr") == "keep\ttab\nnewline\rcr"

    def test_normalize_text_truncates(self) -> None:
        assert normalize_text("héllo  ", max_length=4) == "héll"
        assert normalize_text("a\x00b") == "ab"

    def test_safe_identifier(self) -> None:
        assert safe_identifier("user/123 with spaces") == "user_123_with_spaces"
        assert safe_identifier("ok.id:42-x") == "ok.id:42-x"
        assert len(safe_identifier("x" * 500, max_length=64)) == 64

    def test_constant_time_equals(self) -> None:
        assert constant_time_equals("abc", "abc")
        assert not constant_time_equals("abc", "abd")
        assert not constant_time_equals("abc", "abcd")

    def test_assert_in_allowlist_pass(self) -> None:
        assert assert_in_allowlist("Google", ["google", "openai"], field="provider") == "Google"

    def test_assert_in_allowlist_rejects(self) -> None:
        with pytest.raises(ValueError, match="provider"):
            assert_in_allowlist("evil", ["good"], field="provider")


class TestRateLimiter:
    @pytest.mark.asyncio
    async def test_allows_within_burst(self) -> None:
        rl = TokenBucketRateLimiter(rate_per_sec=1, burst=3)
        assert await rl.try_acquire("k")
        assert await rl.try_acquire("k")
        assert await rl.try_acquire("k")

    @pytest.mark.asyncio
    async def test_blocks_after_burst_exhausted(self) -> None:
        rl = TokenBucketRateLimiter(rate_per_sec=0.001, burst=1)
        assert await rl.try_acquire("k")
        assert not await rl.try_acquire("k")

    @pytest.mark.asyncio
    async def test_independent_per_key(self) -> None:
        rl = TokenBucketRateLimiter(rate_per_sec=0.001, burst=1)
        assert await rl.try_acquire("a")
        assert await rl.try_acquire("b")  # different key, fresh bucket
        assert not await rl.try_acquire("a")

    @pytest.mark.asyncio
    async def test_reset_clears(self) -> None:
        rl = TokenBucketRateLimiter(rate_per_sec=0.001, burst=1)
        assert await rl.try_acquire("k")
        assert not await rl.try_acquire("k")
        await rl.reset("k")
        assert await rl.try_acquire("k")

    def test_invalid_args(self) -> None:
        with pytest.raises(ValueError):
            TokenBucketRateLimiter(rate_per_sec=0, burst=1)
        with pytest.raises(ValueError):
            TokenBucketRateLimiter(rate_per_sec=1, burst=0)
