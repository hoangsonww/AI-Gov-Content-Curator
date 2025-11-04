"""
SynthoraAI Agentic AI Pipeline

A sophisticated, production-ready multi-agent AI system built with LangGraph and LangChain.
"""

__version__ = "1.0.0"
__author__ = "SynthoraAI Team"
__license__ = "MIT"

from .core.pipeline import AgenticPipeline, PipelineStage, AgentState
from .mcp_server.server import MCPServer, create_mcp_server
from .config.settings import settings

__all__ = [
    "AgenticPipeline",
    "PipelineStage",
    "AgentState",
    "MCPServer",
    "create_mcp_server",
    "settings",
]
