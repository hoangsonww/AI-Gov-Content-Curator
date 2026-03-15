"""
MCP server package for the SynthoraAI Agentic Pipeline.
"""
from __future__ import annotations

__all__ = ["AgenticMCPServer", "StandaloneAgenticMCPServer", "create_server", "main"]


def __getattr__(name: str):
    if name in {"AgenticMCPServer", "StandaloneAgenticMCPServer", "create_server", "main"}:
        from .app import AgenticMCPServer, StandaloneAgenticMCPServer, create_server, main
        mapping = {"create_server": create_server, "main": main}
        mapping.update(
            {
                "AgenticMCPServer": AgenticMCPServer,
                "StandaloneAgenticMCPServer": StandaloneAgenticMCPServer,
            }
        )
        return mapping[name]
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
