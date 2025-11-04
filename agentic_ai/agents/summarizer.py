"""
Summarizer Agent - Generates concise summaries of articles.
"""
from typing import Dict, Any, Optional
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from .base_agent import BaseAgent
import structlog

logger = structlog.get_logger()


class SummarizerAgent(BaseAgent):
    """Agent responsible for generating article summaries."""

    def __init__(self):
        """Initialize the Summarizer Agent."""
        super().__init__(name="Summarizer")

        # Define the summarization prompt
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert summarizer specializing in government and news articles.
            Create a concise, accurate summary that:
            1. Captures the main points and key information
            2. Maintains factual accuracy
            3. Uses clear, accessible language
            4. Is 2-3 paragraphs long (150-200 words)
            5. Highlights the most important takeaways

            Focus on the "who, what, when, where, why, and how" of the article.
            Avoid personal opinions or interpretations.
            """),
            ("user", """Article to summarize:

            {content}

            {context_info}

            Provide a clear, concise summary:""")
        ])

        self.chain = self.prompt | self.llm | StrOutputParser()

    def summarize(
        self,
        content: str,
        analyzed_content: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Generate a summary of the article.

        Args:
            content: Article content to summarize
            analyzed_content: Optional pre-analyzed content structure

        Returns:
            Summary string
        """
        try:
            logger.info("Generating summary", content_length=len(content))

            # Build context information from analysis
            context_info = ""
            if analyzed_content:
                context_info = f"""
                Context from analysis:
                - Main topic: {analyzed_content.get('main_topic', 'N/A')}
                - Key entities: {', '.join(analyzed_content.get('entities', {}).get('people', [])[:3])}
                """

            summary = self.chain.invoke({
                "content": content,
                "context_info": context_info
            })

            logger.info("Summary generated", summary_length=len(summary))
            return summary.strip()

        except Exception as e:
            logger.error("Summarization failed", error=str(e))
            error_result = self._handle_error(e, {"content_length": len(content)})
            return f"Error generating summary: {error_result['error']}"

    def process(self, content: str, **kwargs) -> str:
        """Process method implementation."""
        return self.summarize(content, kwargs.get("analyzed_content"))
