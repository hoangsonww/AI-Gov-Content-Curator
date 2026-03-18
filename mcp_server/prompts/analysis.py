"""Analysis and classification prompts."""
from __future__ import annotations


def register_analysis_prompts(mcp) -> None:
    @mcp.prompt()
    async def analyze_sentiment_prompt(content: str) -> str:
        """Prompt template for sentiment analysis."""
        return f"""Analyze the sentiment and emotional tone of the following content.
Consider objectivity, urgency, and controversy level.

Content:
{content}

Analysis:"""

    @mcp.prompt()
    async def classify_article_prompt(content: str) -> str:
        """Prompt template for topic classification and tagging."""
        return f"""Classify the following content into government/news policy categories.

Return:
- Primary topic
- Up to four secondary topics
- Confidence level (0-1) per topic
- 1-2 sentence rationale

Content:
{content}

Classification:"""

    @mcp.prompt()
    async def quality_audit_prompt(content: str, summary: str) -> str:
        """Prompt template for output quality auditing."""
        return f"""Audit whether the provided summary accurately and sufficiently represents the source content.

Source Content:
{content}

Summary:
{summary}

Return:
1. Pass/Fail
2. Numerical score (0-1)
3. Missing critical facts
4. Hallucination risks
5. Revision suggestions"""
