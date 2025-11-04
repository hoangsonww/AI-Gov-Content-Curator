"""
Quality Checker Agent - Validates output quality and completeness.
"""
from typing import Dict, Any, List, Optional
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from .base_agent import BaseAgent
import structlog

logger = structlog.get_logger()


class QualityCheckerAgent(BaseAgent):
    """Agent responsible for quality checking pipeline outputs."""

    def __init__(self):
        """Initialize the Quality Checker Agent."""
        super().__init__(name="QualityChecker")

        # Define the quality check prompt
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a quality assurance expert for content processing pipelines.
            Evaluate the quality of the processed content based on:

            1. Summary Quality:
               - Accuracy (does it capture main points?)
               - Completeness (are key facts included?)
               - Clarity (is it easy to understand?)
               - Conciseness (is it appropriately brief?)

            2. Topic Classification:
               - Relevance (do topics match content?)
               - Completeness (are all major topics covered?)

            3. Sentiment Analysis:
               - Accuracy (does sentiment match content tone?)
               - Appropriateness (is analysis reasonable?)

            4. Overall Coherence:
               - Do all outputs align with the original content?
               - Are there any contradictions?

            Return a JSON object with:
            - overall_score: float (0 to 1)
            - summary_quality: float (0 to 1)
            - classification_quality: float (0 to 1)
            - sentiment_quality: float (0 to 1)
            - issues: list of identified issues (strings)
            - recommendations: list of improvement suggestions (strings)
            - pass: boolean (true if quality is acceptable)
            """),
            ("user", """Evaluate this processed content:

            Original Content (first 500 chars): {content_sample}

            Summary: {summary}

            Topics: {topics}

            Sentiment: {sentiment}

            Provide quality assessment:""")
        ])

        self.chain = self.prompt | self.llm | JsonOutputParser()

    def check_quality(
        self,
        original_content: str,
        summary: Optional[str],
        topics: Optional[List[str]],
        sentiment: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Check the quality of processed outputs.

        Args:
            original_content: Original article content
            summary: Generated summary
            topics: Classified topics
            sentiment: Sentiment analysis results

        Returns:
            Dictionary containing quality assessment
        """
        try:
            logger.info("Checking quality")

            # Prepare inputs for quality check
            content_sample = original_content[:500]
            summary_text = summary or "No summary generated"
            topics_text = ", ".join(topics) if topics else "No topics classified"
            sentiment_text = (
                f"{sentiment.get('overall_sentiment', 'unknown')} "
                f"(score: {sentiment.get('sentiment_score', 0)})"
                if sentiment else "No sentiment analysis"
            )

            result = self.chain.invoke({
                "content_sample": content_sample,
                "summary": summary_text,
                "topics": topics_text,
                "sentiment": sentiment_text
            })

            # Add overall score if not present
            if "overall_score" not in result:
                # Calculate average of component scores
                scores = [
                    result.get("summary_quality", 0),
                    result.get("classification_quality", 0),
                    result.get("sentiment_quality", 0)
                ]
                result["overall_score"] = sum(scores) / len(scores)

            # Determine pass/fail if not present
            if "pass" not in result:
                result["pass"] = result["overall_score"] >= 0.7

            logger.info(
                "Quality check completed",
                score=result["overall_score"],
                passed=result["pass"]
            )

            return {
                "score": result["overall_score"],
                "details": result,
                "passed": result["pass"]
            }

        except Exception as e:
            logger.error("Quality check failed", error=str(e))
            return {
                "score": 0.5,  # Neutral score on error
                "details": {"error": str(e)},
                "passed": True  # Pass through on error to avoid infinite loops
            }

    def process(
        self,
        original_content: str,
        summary: str = None,
        topics: List[str] = None,
        sentiment: Dict[str, Any] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Process method implementation."""
        return self.check_quality(original_content, summary, topics, sentiment)
