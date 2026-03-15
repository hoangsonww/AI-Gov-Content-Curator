"""Resource registration entrypoint."""
from __future__ import annotations

from .config import register_config_resources
from .jobs import register_job_resources
from .runtime import register_runtime_resources


def register_resources(mcp, runtime) -> None:
    register_config_resources(mcp, runtime)
    register_runtime_resources(mcp, runtime)
    register_job_resources(mcp, runtime)
