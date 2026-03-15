"""
MCP server application composition root.
"""
from __future__ import annotations

import structlog
from mcp.server.fastmcp import FastMCP

from agentic_ai.config.settings import settings

from .logging_config import configure_logging
from .prompts import register_prompts
from .resources import register_resources
from .runtime import ServerRuntime
from .tools import register_tools


class AgenticMCPServer:
    """MCP server wiring for tools, resources, and prompts."""

    def __init__(self) -> None:
        configure_logging()
        logger = structlog.get_logger("mcp_server")
        self.logger = logger.bind(
            component="mcp_server",
            service=settings.mcp_server_name,
            version=settings.mcp_server_version,
            environment=settings.environment,
        )
        self.logger.info("initializing")

        self.runtime = ServerRuntime()
        if not self.runtime.ready:
            self.logger.warning(
                "runtime.degraded",
                startup_error=self.runtime.startup_error,
            )
        self.mcp = FastMCP(settings.mcp_server_name)

        register_tools(self.mcp, self.runtime, self.logger)
        register_resources(self.mcp, self.runtime)
        register_prompts(self.mcp)
        self.logger.info("initialized")

    def run(self) -> None:
        """Run the MCP server using stdio transport."""
        self.logger.info("starting", transport="stdio")
        self.mcp.run(transport="stdio")


def create_server() -> AgenticMCPServer:
    return AgenticMCPServer()


# Backward-compatible alias.
StandaloneAgenticMCPServer = AgenticMCPServer


def main() -> None:
    create_server().run()
