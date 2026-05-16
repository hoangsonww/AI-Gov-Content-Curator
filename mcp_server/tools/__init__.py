"""Tool registration entrypoint."""

from __future__ import annotations

import structlog
from mcp.server.fastmcp import FastMCP

from ..runtime import ServerRuntime
from .acp import register_acp_tools
from .analysis import register_analysis_tools
from .operations import register_operations_tools
from .processing import register_processing_tools


def register_tools(mcp: FastMCP, runtime: ServerRuntime, logger: structlog.BoundLogger) -> None:
    register_processing_tools(mcp, runtime, logger)
    register_analysis_tools(mcp, runtime, logger)
    register_operations_tools(mcp, runtime, logger)
    register_acp_tools(mcp, runtime, logger)
