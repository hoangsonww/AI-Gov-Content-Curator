"""Liveness/readiness/health smoke tests."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any, cast

import pytest

from mcp_server import health
from mcp_server.runtime import ServerRuntime


class _FakeAcp:
    async def stats(self) -> dict[str, int]:
        return {"agents": 0, "messages": 0}


class _FakeJobs:
    async def stats(self) -> dict[str, Any]:
        return {
            "total_jobs": 0,
            "completed": 0,
            "failed": 0,
            "processing": 0,
            "pending": 0,
            "success_rate": 0.0,
        }


class _FakeRuntime:
    def __init__(self, *, ready: bool, acp_ready: bool = True) -> None:
        self.ready = ready
        self.startup_error = None if ready else "boom"
        self.started_at = "2026-01-01T00:00:00Z"
        self.acp_backend = "memory"
        self.acp = _FakeAcp()
        self.jobs = _FakeJobs()
        self.pipeline = (
            SimpleNamespace(
                content_analyzer=object(),
                summarizer=object(),
                classifier=object(),
                sentiment_analyzer=object(),
                quality_checker=object(),
                app=object(),
            )
            if ready
            else None
        )
        self._acp_ready = acp_ready

    def readiness(self) -> dict[str, Any]:
        return {
            "ready": self.ready and self.pipeline is not None,
            "startup_error": self.startup_error,
            "started_at": self.started_at,
            "acp_backend": self.acp_backend,
        }

    async def acp_preflight(self) -> dict[str, Any]:
        return {"enabled": True, "ready": self._acp_ready, "checks": {}}


def _runtime(*, ready: bool, acp_ready: bool = True) -> ServerRuntime:
    """Build a structural ServerRuntime stand-in for the health probes."""
    return cast(ServerRuntime, _FakeRuntime(ready=ready, acp_ready=acp_ready))


@pytest.mark.asyncio
async def test_liveness_always_alive() -> None:
    r = await health.liveness(_runtime(ready=False))
    assert r["status"] == "alive"


@pytest.mark.asyncio
async def test_readiness_when_ready() -> None:
    r = await health.readiness(_runtime(ready=True, acp_ready=True))
    assert r["status"] == "ready"
    assert r["ready"] is True


@pytest.mark.asyncio
async def test_readiness_when_acp_down() -> None:
    r = await health.readiness(_runtime(ready=True, acp_ready=False))
    assert r["status"] == "not_ready"
    assert r["ready"] is False


@pytest.mark.asyncio
async def test_readiness_when_pipeline_down() -> None:
    r = await health.readiness(_runtime(ready=False))
    assert r["ready"] is False


@pytest.mark.asyncio
async def test_health_returns_full_report() -> None:
    r = await health.health(_runtime(ready=True))
    assert r["status"] in {"healthy", "degraded"}
    assert "providers" in r
    assert "limits" in r
