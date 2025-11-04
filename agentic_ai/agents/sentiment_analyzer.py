"""
Sentiment Analyzer Agent - Analyzes emotional tone and sentiment.
"""
from typing import Dict, Optional
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from .base_agent import BaseAgent
import structlog

logger = structlog.get_logger()


class SentimentAnalyzerAgent(BaseAgent):
    """Agent responsible for analyzing sentiment and emotional tone."""

    def __init__(self):
        """Initialize the Sentiment Analyzer Agent."""
        super().__init__(name="SentimentAnalyzer")

        # Define the sentiment analysis prompt
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert sentiment analyzer for government and news articles.
            Analyze the emotional tone and sentiment of the content.

            Provide analysis on multiple dimensions:
            1. Overall sentiment: positive, negative, or neutral
            2. Emotional tone: analytical, passionate, concerned, optimistic, etc.
            3. Objectivity: how objective vs. subjective the content is
            4. Urgency: how urgent or time-sensitive the topic is presented
            5. Controversy level: how controversial the topic is

            Return a JSON object with:
            - overall_sentiment: string (positive/negative/neutral)
            - sentiment_score: float (-1 to 1, where -1 is most negative, 1 is most positive)
            - emotional_tone: string
            - objectivity_score: float (0 to 1, where 1 is most objective)
            - urgency_level: string (low/medium/high)
            - controversy_level: string (low/medium/high)
            - key_phrases: list of strings that indicate sentiment
            - confidence: float (0 to 1)
            """),
            ("user", """Analyze the sentiment of this content:

            {content}

            {summary_info}

            Provide sentiment analysis:""")
        ])

        self.chain = self.prompt | self.llm | JsonOutputParser()

    def analyze_sentiment(
        self,
        content: str,
        summary: Optional[str] = None
    ) -> Dict[str, any]:
        """
        Analyze sentiment of the article.

        Args:
            content: Article content to analyze
            summary: Optional summary to help with analysis

        Returns:
            Dictionary containing sentiment analysis
        """
        try:
            logger.info("Analyzing sentiment", content_length=len(content))

            summary_info = f"Summary: {summary}" if summary else ""

            result = self.chain.invoke({
                "content": content[:4000],  # Limit for sentiment analysis
                "summary_info": summary_info
            })

            logger.info(
                "Sentiment analysis completed",
                sentiment=result.get("overall_sentiment"),
                score=result.get("sentiment_score")
            )

            return result

        except Exception as e:
            logger.error("Sentiment analysis failed", error=str(e))
            return {
                "overall_sentiment": "neutral",
                "sentiment_score": 0.0,
                "emotional_tone": "unknown",
                "objectivity_score": 0.5,
                "urgency_level": "medium",
                "controversy_level": "low",
                "key_phrases": [],
                "confidence": 0.0,
                "error": str(e)
            }

    def process(self, content: str, **kwargs) -> Dict[str, any]:
        """Process method implementation."""
        return self.analyze_sentiment(content, kwargs.get("summary"))
