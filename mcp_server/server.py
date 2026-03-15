"""
Compatibility wrapper for MCP server entrypoints.
"""
from __future__ import annotations

from .app import AgenticMCPServer, StandaloneAgenticMCPServer, create_server, main

__all__ = [
    "AgenticMCPServer",
    "StandaloneAgenticMCPServer",
    "create_server",
    "main",
]


if __name__ == "__main__":
    main()
