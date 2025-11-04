"""
Assembly Line Architecture for Agentic AI Pipeline using LangGraph.
This implements a sophisticated multi-agent system with state management.
"""
from typing import Dict, Any, List, Optional, TypedDict, Annotated
from enum import Enum
import operator
from datetime import datetime

from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolExecutor
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from ..config.settings import settings
from ..agents.content_analyzer import ContentAnalyzerAgent
from ..agents.summarizer import SummarizerAgent
from ..agents.classifier import ClassifierAgent
from ..agents.sentiment_analyzer import SentimentAnalyzerAgent
from ..agents.quality_checker import QualityCheckerAgent
import structlog

logger = structlog.get_logger()


class PipelineStage(str, Enum):
    """Pipeline stages in the assembly line."""
    INTAKE = "intake"
    CONTENT_ANALYSIS = "content_analysis"
    SUMMARIZATION = "summarization"
    CLASSIFICATION = "classification"
    SENTIMENT_ANALYSIS = "sentiment_analysis"
    QUALITY_CHECK = "quality_check"
    OUTPUT = "output"
    ERROR = "error"


class AgentState(TypedDict):
    """State object passed between agents in the pipeline."""
    # Input data
    article_id: str
    raw_content: str
    url: str
    source: str

    # Processing metadata
    current_stage: PipelineStage
    timestamp: str
    iteration: int

    # Processed data
    analyzed_content: Optional[Dict[str, Any]]
    summary: Optional[str]
    topics: Optional[List[str]]
    sentiment: Optional[Dict[str, float]]
    quality_score: Optional[float]

    # Messages and errors
    messages: Annotated[List[BaseMessage], operator.add]
    errors: Annotated[List[str], operator.add]

    # Decisions and routing
    should_continue: bool
    next_stage: Optional[str]


class AgenticPipeline:
    """
    Production-ready Agentic AI Pipeline using LangGraph assembly line architecture.

    This pipeline processes articles through multiple specialized agents:
    1. Content Analysis: Extracts key information and structure
    2. Summarization: Generates concise summaries
    3. Classification: Categorizes content by topics
    4. Sentiment Analysis: Analyzes emotional tone
    5. Quality Check: Validates output quality
    """

    def __init__(self):
        """Initialize the pipeline with all agents and graph."""
        logger.info("Initializing Agentic AI Pipeline")

        # Initialize agents
        self.content_analyzer = ContentAnalyzerAgent()
        self.summarizer = SummarizerAgent()
        self.classifier = ClassifierAgent()
        self.sentiment_analyzer = SentimentAnalyzerAgent()
        self.quality_checker = QualityCheckerAgent()

        # Build the pipeline graph
        self.graph = self._build_graph()
        self.app = self.graph.compile()

        logger.info("Pipeline initialized successfully")

    def _build_graph(self) -> StateGraph:
        """Build the LangGraph state machine for the pipeline."""
        workflow = StateGraph(AgentState)

        # Add nodes for each stage
        workflow.add_node("intake", self._intake_node)
        workflow.add_node("content_analysis", self._content_analysis_node)
        workflow.add_node("summarization", self._summarization_node)
        workflow.add_node("classification", self._classification_node)
        workflow.add_node("sentiment_analysis", self._sentiment_analysis_node)
        workflow.add_node("quality_check", self._quality_check_node)
        workflow.add_node("output", self._output_node)

        # Set entry point
        workflow.set_entry_point("intake")

        # Define edges (assembly line flow)
        workflow.add_edge("intake", "content_analysis")
        workflow.add_edge("content_analysis", "summarization")
        workflow.add_edge("summarization", "classification")
        workflow.add_edge("classification", "sentiment_analysis")
        workflow.add_edge("sentiment_analysis", "quality_check")

        # Quality check can loop back or proceed to output
        workflow.add_conditional_edges(
            "quality_check",
            self._should_continue,
            {
                "output": "output",
                "content_analysis": "content_analysis",
                END: END
            }
        )

        workflow.add_edge("output", END)

        return workflow

    def _intake_node(self, state: AgentState) -> AgentState:
        """Initial intake node that validates input."""
        logger.info("Pipeline stage: INTAKE", article_id=state.get("article_id"))

        state["current_stage"] = PipelineStage.INTAKE
        state["timestamp"] = datetime.utcnow().isoformat()
        state["iteration"] = state.get("iteration", 0) + 1

        # Validate required fields
        if not state.get("raw_content"):
            state["errors"].append("Missing raw_content")
            state["should_continue"] = False
            return state

        state["messages"].append(
            HumanMessage(content=f"Processing article: {state.get('article_id')}")
        )
        state["should_continue"] = True

        return state

    def _content_analysis_node(self, state: AgentState) -> AgentState:
        """Content analysis stage."""
        logger.info("Pipeline stage: CONTENT_ANALYSIS", article_id=state.get("article_id"))

        state["current_stage"] = PipelineStage.CONTENT_ANALYSIS

        try:
            result = self.content_analyzer.analyze(
                content=state["raw_content"],
                metadata={"url": state.get("url"), "source": state.get("source")}
            )
            state["analyzed_content"] = result
            state["messages"].append(
                AIMessage(content="Content analysis completed")
            )
        except Exception as e:
            logger.error("Content analysis failed", error=str(e))
            state["errors"].append(f"Content analysis error: {str(e)}")

        return state

    def _summarization_node(self, state: AgentState) -> AgentState:
        """Summarization stage."""
        logger.info("Pipeline stage: SUMMARIZATION", article_id=state.get("article_id"))

        state["current_stage"] = PipelineStage.SUMMARIZATION

        try:
            summary = self.summarizer.summarize(
                content=state["raw_content"],
                analyzed_content=state.get("analyzed_content")
            )
            state["summary"] = summary
            state["messages"].append(
                AIMessage(content="Summarization completed")
            )
        except Exception as e:
            logger.error("Summarization failed", error=str(e))
            state["errors"].append(f"Summarization error: {str(e)}")

        return state

    def _classification_node(self, state: AgentState) -> AgentState:
        """Classification stage."""
        logger.info("Pipeline stage: CLASSIFICATION", article_id=state.get("article_id"))

        state["current_stage"] = PipelineStage.CLASSIFICATION

        try:
            topics = self.classifier.classify(
                content=state["raw_content"],
                summary=state.get("summary")
            )
            state["topics"] = topics
            state["messages"].append(
                AIMessage(content=f"Classification completed: {', '.join(topics)}")
            )
        except Exception as e:
            logger.error("Classification failed", error=str(e))
            state["errors"].append(f"Classification error: {str(e)}")

        return state

    def _sentiment_analysis_node(self, state: AgentState) -> AgentState:
        """Sentiment analysis stage."""
        logger.info("Pipeline stage: SENTIMENT_ANALYSIS", article_id=state.get("article_id"))

        state["current_stage"] = PipelineStage.SENTIMENT_ANALYSIS

        try:
            sentiment = self.sentiment_analyzer.analyze_sentiment(
                content=state["raw_content"],
                summary=state.get("summary")
            )
            state["sentiment"] = sentiment
            state["messages"].append(
                AIMessage(content="Sentiment analysis completed")
            )
        except Exception as e:
            logger.error("Sentiment analysis failed", error=str(e))
            state["errors"].append(f"Sentiment analysis error: {str(e)}")

        return state

    def _quality_check_node(self, state: AgentState) -> AgentState:
        """Quality check stage."""
        logger.info("Pipeline stage: QUALITY_CHECK", article_id=state.get("article_id"))

        state["current_stage"] = PipelineStage.QUALITY_CHECK

        try:
            quality_result = self.quality_checker.check_quality(
                original_content=state["raw_content"],
                summary=state.get("summary"),
                topics=state.get("topics"),
                sentiment=state.get("sentiment")
            )

            state["quality_score"] = quality_result["score"]

            # Determine if we should continue or retry
            if quality_result["score"] < 0.7 and state["iteration"] < settings.max_iterations:
                state["should_continue"] = True
                state["next_stage"] = "content_analysis"  # Retry from content analysis
                state["messages"].append(
                    AIMessage(content=f"Quality check failed (score: {quality_result['score']}), retrying...")
                )
            else:
                state["should_continue"] = True
                state["next_stage"] = "output"
                state["messages"].append(
                    AIMessage(content=f"Quality check passed (score: {quality_result['score']})")
                )
        except Exception as e:
            logger.error("Quality check failed", error=str(e))
            state["errors"].append(f"Quality check error: {str(e)}")
            state["should_continue"] = True
            state["next_stage"] = "output"

        return state

    def _output_node(self, state: AgentState) -> AgentState:
        """Final output node."""
        logger.info("Pipeline stage: OUTPUT", article_id=state.get("article_id"))

        state["current_stage"] = PipelineStage.OUTPUT
        state["should_continue"] = False

        return state

    def _should_continue(self, state: AgentState) -> str:
        """Determine next stage based on quality check."""
        if not state.get("should_continue", True):
            return END

        next_stage = state.get("next_stage", "output")
        return next_stage

    async def process_article(self, article_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process an article through the entire pipeline.

        Args:
            article_data: Dictionary containing article information

        Returns:
            Dictionary with processed results
        """
        logger.info("Starting article processing", article_id=article_data.get("id"))

        # Initialize state
        initial_state: AgentState = {
            "article_id": article_data.get("id", "unknown"),
            "raw_content": article_data.get("content", ""),
            "url": article_data.get("url", ""),
            "source": article_data.get("source", ""),
            "current_stage": PipelineStage.INTAKE,
            "timestamp": datetime.utcnow().isoformat(),
            "iteration": 0,
            "analyzed_content": None,
            "summary": None,
            "topics": None,
            "sentiment": None,
            "quality_score": None,
            "messages": [],
            "errors": [],
            "should_continue": True,
            "next_stage": None
        }

        try:
            # Run the pipeline
            final_state = await self.app.ainvoke(initial_state)

            # Extract results
            result = {
                "article_id": final_state["article_id"],
                "summary": final_state.get("summary"),
                "topics": final_state.get("topics", []),
                "sentiment": final_state.get("sentiment"),
                "quality_score": final_state.get("quality_score"),
                "analyzed_content": final_state.get("analyzed_content"),
                "iterations": final_state.get("iteration"),
                "errors": final_state.get("errors", []),
                "timestamp": final_state["timestamp"]
            }

            logger.info(
                "Article processing completed",
                article_id=result["article_id"],
                quality_score=result.get("quality_score"),
                iterations=result.get("iterations")
            )

            return result

        except Exception as e:
            logger.error("Pipeline execution failed", error=str(e), article_id=article_data.get("id"))
            return {
                "article_id": article_data.get("id"),
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }

    def visualize(self) -> str:
        """Generate a mermaid diagram of the pipeline."""
        return self.app.get_graph().draw_mermaid()
