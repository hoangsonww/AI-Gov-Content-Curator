"""Prompt registration entrypoint."""
from __future__ import annotations

from .analysis import register_analysis_prompts
from .governance import register_governance_prompts
from .summarization import register_summarization_prompts


def register_prompts(mcp) -> None:
    register_summarization_prompts(mcp)
    register_analysis_prompts(mcp)
    register_governance_prompts(mcp)
