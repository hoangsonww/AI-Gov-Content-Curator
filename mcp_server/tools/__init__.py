"""Tool registration entrypoint."""
from __future__ import annotations

from .analysis import register_analysis_tools
from .operations import register_operations_tools
from .processing import register_processing_tools


def register_tools(mcp, runtime, logger) -> None:
    register_processing_tools(mcp, runtime, logger)
    register_analysis_tools(mcp, runtime, logger)
    register_operations_tools(mcp, runtime, logger)
