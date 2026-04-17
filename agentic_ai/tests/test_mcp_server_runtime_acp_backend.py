from __future__ import annotations

import builtins

import pytest

from mcp_server.runtime import ServerRuntime


def test_runtime_falls_back_to_memory_when_not_production(monkeypatch) -> None:
    monkeypatch.setattr("mcp_server.runtime.settings.acp_enabled", True)
    monkeypatch.setattr("mcp_server.runtime.settings.acp_backend", "redis")
    monkeypatch.setattr("mcp_server.runtime.settings.environment", "development")

    runtime = ServerRuntime()

    assert runtime.acp_backend in {"redis", "memory"}


def test_runtime_requires_redis_in_production(monkeypatch) -> None:
    monkeypatch.setattr("mcp_server.runtime.settings.acp_enabled", True)
    monkeypatch.setattr("mcp_server.runtime.settings.acp_backend", "redis")
    monkeypatch.setattr("mcp_server.runtime.settings.environment", "production")
    real_import = builtins.__import__

    def fail_redis_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name == "redis.asyncio":
            raise ModuleNotFoundError("No module named 'redis'")
        return real_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", fail_redis_import)

    with pytest.raises(RuntimeError):
        ServerRuntime()
