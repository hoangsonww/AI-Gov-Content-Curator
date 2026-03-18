"""Summarization prompts."""
from __future__ import annotations


def register_summarization_prompts(mcp) -> None:
    @mcp.prompt()
    async def summarize_article_prompt(article_content: str) -> str:
        """Prompt template for concise article summaries."""
        return f"""Please provide a concise summary of the following article.
Focus on the main points, key facts, and important takeaways.

Article:
{article_content}

Summary:"""

    @mcp.prompt()
    async def executive_brief_prompt(article_content: str, audience: str = "policy leadership") -> str:
        """Prompt template for executive briefing style summaries."""
        return f"""Prepare an executive brief for {audience} based on the article below.

Requirements:
- One paragraph strategic context
- Three bullet points of critical developments
- Two risks and two opportunities
- One recommended next action

Article:
{article_content}

Executive Brief:"""
