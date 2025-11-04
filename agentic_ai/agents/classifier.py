"""
Classifier Agent - Categorizes articles into topics.
"""
from typing import List, Optional
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from .base_agent import BaseAgent
import structlog

logger = structlog.get_logger()


class ClassifierAgent(BaseAgent):
    """Agent responsible for classifying articles into topics."""

    # Predefined topic categories
    TOPIC_CATEGORIES = [
        "Politics & Governance",
        "Economy & Finance",
        "Healthcare",
        "Education",
        "Environment & Climate",
        "Technology & Innovation",
        "Security & Defense",
        "Social Issues",
        "Infrastructure",
        "International Relations",
        "Law & Justice",
        "Public Safety",
        "Energy",
        "Transportation",
        "Science & Research"
    ]

    def __init__(self):
        """Initialize the Classifier Agent."""
        super().__init__(name="Classifier")

        # Define the classification prompt
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", f"""You are an expert content classifier for government and news articles.
            Classify the content into relevant topic categories from this list:

            {', '.join(self.TOPIC_CATEGORIES)}

            Guidelines:
            1. Select 1-5 most relevant topics
            2. Order them by relevance (most relevant first)
            3. Be specific but not overly narrow
            4. Consider both primary and secondary topics

            Return a JSON object with:
            - topics: list of selected topics (strings)
            - confidence: list of confidence scores (0-1) for each topic
            - reasoning: brief explanation of classification
            """),
            ("user", """Classify this content:

            Content: {content}

            {summary_info}

            Return the classification:""")
        ])

        self.chain = self.prompt | self.llm | JsonOutputParser()

    def classify(self, content: str, summary: Optional[str] = None) -> List[str]:
        """
        Classify article into topic categories.

        Args:
            content: Article content to classify
            summary: Optional summary to help with classification

        Returns:
            List of topic strings
        """
        try:
            logger.info("Classifying content", content_length=len(content))

            summary_info = f"Summary: {summary}" if summary else ""

            result = self.chain.invoke({
                "content": content[:3000],  # Limit for classification
                "summary_info": summary_info
            })

            topics = result.get("topics", [])
            logger.info("Classification completed", topics=topics)

            return topics

        except Exception as e:
            logger.error("Classification failed", error=str(e))
            # Return default topic on error
            return ["General"]

    def process(self, content: str, **kwargs) -> List[str]:
        """Process method implementation."""
        return self.classify(content, kwargs.get("summary"))
