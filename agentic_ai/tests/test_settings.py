"""Tests for the strict Settings model."""

from __future__ import annotations

import os
from collections.abc import Iterator
from contextlib import contextmanager

import pytest


@contextmanager
def env(**overrides: str) -> Iterator[None]:
    """Temporarily override environment variables."""
    original = {}
    for key, value in overrides.items():
        original[key] = os.environ.get(key)
        os.environ[key] = value
    try:
        yield
    finally:
        for key, prior in original.items():
            if prior is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = prior


def _settings_class():
    """Import fresh so model-validator picks up the env state."""
    from agentic_ai.config.settings import Settings

    return Settings


def test_test_env_does_not_require_key() -> None:
    Settings = _settings_class()
    with env(ENVIRONMENT="test", GOOGLE_AI_API_KEY=""):
        s = Settings()
        assert s.environment == "test"
        assert s.get_provider_key("google") is None


def test_production_requires_default_provider_key() -> None:
    Settings = _settings_class()
    with (
        env(
            ENVIRONMENT="production",
            DEFAULT_LLM_PROVIDER="openai",
            OPENAI_API_KEY="",
            ANTHROPIC_API_KEY="",
            GOOGLE_AI_API_KEY="",
            COHERE_API_KEY="",
        ),
        pytest.raises(ValueError, match="OPENAI"),
    ):
        Settings()


def test_production_accepts_with_key() -> None:
    Settings = _settings_class()
    with env(
        ENVIRONMENT="production",
        DEFAULT_LLM_PROVIDER="openai",
        OPENAI_API_KEY="sk-fake",
    ):
        s = Settings()
        assert s.get_provider_key("openai") == "sk-fake"


def test_log_level_uppercased() -> None:
    _settings_class()
    with env(ENVIRONMENT="test", LOG_LEVEL="info"):
        assert _settings_class()().log_level == "INFO"


def test_invalid_log_level_rejected() -> None:
    Settings = _settings_class()
    with env(ENVIRONMENT="test", LOG_LEVEL="LOUD"), pytest.raises(Exception):
        Settings()


def test_provider_lookup_for_unknown_returns_none() -> None:
    Settings = _settings_class()
    with env(ENVIRONMENT="test"):
        s = Settings()
        assert s.get_provider_key("unknown") is None
