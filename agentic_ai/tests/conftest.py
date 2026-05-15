"""Shared pytest fixtures for agentic_ai + mcp_server."""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from typing import Any

import pytest

# Ensure the repo root is on PYTHONPATH so `agentic_ai` and `mcp_server`
# resolve regardless of where pytest is invoked from.
_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

# Pin env to a test-friendly profile before settings is imported.
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("LOG_JSON", "false")
os.environ.setdefault("LOG_LEVEL", "WARNING")
os.environ.setdefault("ACP_BACKEND", "memory")
os.environ.setdefault("OTEL_EXPORTER_OTLP_ENDPOINT", "")
os.environ.setdefault("OTEL_TRACES_SAMPLE_RATIO", "0")


@pytest.fixture(scope="session")
def event_loop() -> Any:
    """Session-scoped loop so async fixtures persist across tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def fresh_metrics_registry() -> Any:
    """Reset the metrics singleton between tests to avoid label leakage."""
    from mcp_server import observability

    observability._metrics = None
    yield observability.metrics()
    observability._metrics = None


@pytest.fixture
def reset_circuit_breakers() -> Any:
    from mcp_server import resilience

    resilience._breakers.clear()
    yield
    resilience._breakers.clear()
