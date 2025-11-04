"""
Content Analyzer Agent - Extracts structure and key information from articles.
"""
from typing import Dict, Any, Optional
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from .base_agent import BaseAgent
import structlog

logger = structlog.get_logger()


class ContentAnalyzerAgent(BaseAgent):
    """Agent responsible for analyzing content structure and extracting key information."""

    def __init__(self):
        """Initialize the Content Analyzer Agent."""
        super().__init__(name="ContentAnalyzer")

        # Define the analysis prompt
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert content analyzer for government and news articles.
            Analyze the provided content and extract:
            1. Main topic and subtopics
            2. Key entities (people, organizations, locations)
            3. Important dates and events
            4. Content structure (introduction, body, conclusion)
            5. Writing style and tone

            Return your analysis as a JSON object with these fields:
            - main_topic: string
            - subtopics: list of strings
            - entities: dict with keys: people, organizations, locations
            - key_dates: list of strings
            - structure: dict with keys: has_intro, has_body, has_conclusion
            - style: string (formal, informal, technical, etc.)
            - tone: string (neutral, positive, negative, analytical, etc.)
            - word_count: integer
            - estimated_reading_time: integer (in minutes)
            """),
            ("user", "Analyze this content:\n\n{content}\n\nMetadata: {metadata}")
        ])

        self.chain = self.prompt | self.llm | JsonOutputParser()

    def analyze(self, content: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Analyze article content.

        Args:
            content: Article content to analyze
            metadata: Optional metadata about the article

        Returns:
            Dictionary containing analysis results
        """
        try:
            logger.info("Analyzing content", content_length=len(content))

            result = self.chain.invoke({
                "content": content[:5000],  # Limit to first 5000 chars for analysis
                "metadata": metadata or {}
            })

            logger.info("Content analysis completed", main_topic=result.get("main_topic"))
            return result

        except Exception as e:
            logger.error("Content analysis failed", error=str(e))
            return self._handle_error(e, {"content_length": len(content)})

    def process(self, content: str, **kwargs) -> Dict[str, Any]:
        """Process method implementation."""
        return self.analyze(content, kwargs.get("metadata"))
