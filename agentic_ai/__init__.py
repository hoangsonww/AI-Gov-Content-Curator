"""
SynthoraAI Agentic AI Pipeline

A sophisticated, production-ready multi-agent AI system built with LangGraph and LangChain.
"""
from __future__ import annotations

__version__ = "1.0.0"
__author__ = "SynthoraAI Team"
__license__ = "MIT"

__all__ = [
    "AgenticPipeline",
    "PipelineStage",
    "AgentState",
    "settings",
]


def __getattr__(name: str):
    """
    Lazy imports to avoid importing heavy LangGraph/LLM dependencies on package import.
    """
    if name == "settings":
        from .config.settings import settings as _settings
        return _settings

    if name in {"AgenticPipeline", "PipelineStage", "AgentState"}:
        from .core.pipeline import AgenticPipeline, PipelineStage, AgentState
        mapping = {
            "AgenticPipeline": AgenticPipeline,
            "PipelineStage": PipelineStage,
            "AgentState": AgentState,
        }
        return mapping[name]

    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
