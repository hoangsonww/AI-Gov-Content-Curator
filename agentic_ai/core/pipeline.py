"""
Assembly Line Architecture for Agentic AI Pipeline using LangGraph.
This implements a sophisticated multi-agent system with state management.
"""

import operator
import time
from datetime import UTC, datetime
from enum import Enum
from typing import Annotated, Any, TypedDict

import structlog
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langgraph.graph import END, StateGraph

from mcp_server.observability import metrics, traced_async_span, traced_span
from mcp_server.resilience import with_async_timeout

from ..agents.classifier import ClassifierAgent
from ..agents.content_analyzer import ContentAnalyzerAgent
from ..agents.quality_checker import QualityCheckerAgent
from ..agents.sentiment_analyzer import SentimentAnalyzerAgent
from ..agents.summarizer import SummarizerAgent
from ..config.settings import settings

logger = structlog.get_logger("agentic.pipeline")


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


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
    analyzed_content: dict[str, Any] | None
    summary: str | None
    topics: list[str] | None
    sentiment: dict[str, float] | None
    quality_score: float | None

    # Messages and errors
    messages: Annotated[list[BaseMessage], operator.add]
    errors: Annotated[list[str], operator.add]

    # Decisions and routing
    should_continue: bool
    next_stage: str | None


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
            {"output": "output", "content_analysis": "content_analysis", END: END},
        )

        workflow.add_edge("output", END)

        return workflow

    def _intake_node(self, state: AgentState) -> AgentState:
        """Initial intake node that validates input."""
        logger.info("pipeline.stage.intake", article_id=state.get("article_id"))

        state["current_stage"] = PipelineStage.INTAKE
        state["timestamp"] = _utc_now_iso()
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

    def _run_agent_node(
        self,
        state: AgentState,
        *,
        stage: PipelineStage,
        agent_name: str,
        runner,  # callable returning result
        on_success,  # callable(state, result) → None
    ) -> AgentState:
        """Shared boilerplate: trace span, metrics, error capture per stage."""
        state["current_stage"] = stage
        start = time.monotonic()
        article_id = state.get("article_id", "unknown")
        logger.info(
            "pipeline.stage.start",
            stage=stage.value,
            agent=agent_name,
            article_id=article_id,
        )
        with traced_span(
            f"pipeline.stage.{stage.value}",
            **{
                "pipeline.stage": stage.value,
                "agent.name": agent_name,
                "article.id": article_id,
            },
        ):
            try:
                result = runner()
                on_success(state, result)
                state["messages"].append(AIMessage(content=f"{agent_name} completed"))
                metrics().agent_invocations_total.labels(agent=agent_name, status="ok").inc()
            except Exception as exc:
                logger.exception(
                    "pipeline.stage.failed",
                    stage=stage.value,
                    agent=agent_name,
                    error=str(exc),
                )
                state["errors"].append(f"{stage.value} error: {exc}")
                metrics().agent_invocations_total.labels(agent=agent_name, status="error").inc()
            finally:
                duration = time.monotonic() - start
                metrics().agent_duration_seconds.labels(agent=agent_name).observe(duration)
        return state

    def _content_analysis_node(self, state: AgentState) -> AgentState:
        return self._run_agent_node(
            state,
            stage=PipelineStage.CONTENT_ANALYSIS,
            agent_name="content_analyzer",
            runner=lambda: self.content_analyzer.analyze(
                content=state["raw_content"],
                metadata={"url": state.get("url"), "source": state.get("source")},
            ),
            on_success=lambda s, result: s.__setitem__("analyzed_content", result),
        )

    def _summarization_node(self, state: AgentState) -> AgentState:
        return self._run_agent_node(
            state,
            stage=PipelineStage.SUMMARIZATION,
            agent_name="summarizer",
            runner=lambda: self.summarizer.summarize(
                content=state["raw_content"],
                analyzed_content=state.get("analyzed_content"),
            ),
            on_success=lambda s, result: s.__setitem__("summary", result),
        )

    def _classification_node(self, state: AgentState) -> AgentState:
        return self._run_agent_node(
            state,
            stage=PipelineStage.CLASSIFICATION,
            agent_name="classifier",
            runner=lambda: self.classifier.classify(
                content=state["raw_content"],
                summary=state.get("summary"),
            ),
            on_success=lambda s, result: s.__setitem__("topics", result),
        )

    def _sentiment_analysis_node(self, state: AgentState) -> AgentState:
        return self._run_agent_node(
            state,
            stage=PipelineStage.SENTIMENT_ANALYSIS,
            agent_name="sentiment_analyzer",
            runner=lambda: self.sentiment_analyzer.analyze_sentiment(
                content=state["raw_content"],
                summary=state.get("summary"),
            ),
            on_success=lambda s, result: s.__setitem__("sentiment", result),
        )

    def _quality_check_node(self, state: AgentState) -> AgentState:
        """Quality check stage."""
        logger.info("Pipeline stage: QUALITY_CHECK", article_id=state.get("article_id"))

        state["current_stage"] = PipelineStage.QUALITY_CHECK

        try:
            quality_result = self.quality_checker.check_quality(
                original_content=state["raw_content"],
                summary=state.get("summary"),
                topics=state.get("topics"),
                sentiment=state.get("sentiment"),
            )

            state["quality_score"] = quality_result["score"]

            # Determine if we should continue or retry
            if quality_result["score"] < 0.7 and state["iteration"] < settings.max_iterations:
                state["iteration"] = state.get("iteration", 0) + 1
                state["should_continue"] = True
                state["next_stage"] = "content_analysis"  # Retry from content analysis
                state["messages"].append(
                    AIMessage(
                        content=f"Quality check failed (score: {quality_result['score']}), retrying..."
                    )
                )
            else:
                state["should_continue"] = True
                state["next_stage"] = "output"
                state["messages"].append(
                    AIMessage(content=f"Quality check passed (score: {quality_result['score']})")
                )
        except Exception as e:
            logger.error("Quality check failed", error=str(e))
            state["errors"].append(f"Quality check error: {e!s}")
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

        return state.get("next_stage", "output")

    async def process_article(self, article_data: dict[str, Any]) -> dict[str, Any]:
        """
        Process an article through the entire pipeline.

        Emits a top-level OTel span and Prometheus metrics, enforces a
        deadline equal to `settings.agent_timeout` multiplied by the max
        iterations so a runaway quality-check loop cannot wedge a worker.
        """
        article_id = article_data.get("id", "unknown")
        log = logger.bind(article_id=article_id)
        log.info("pipeline.start")

        initial_state: AgentState = {
            "article_id": article_id,
            "raw_content": article_data.get("content", ""),
            "url": article_data.get("url", ""),
            "source": article_data.get("source", ""),
            "current_stage": PipelineStage.INTAKE,
            "timestamp": _utc_now_iso(),
            "iteration": 0,
            "analyzed_content": None,
            "summary": None,
            "topics": None,
            "sentiment": None,
            "quality_score": None,
            "messages": [],
            "errors": [],
            "should_continue": True,
            "next_stage": None,
        }

        # Top-level deadline. Loosely bounded; per-stage timeouts give finer control.
        deadline_s = float(settings.agent_timeout) * max(1, settings.max_iterations)
        start = time.monotonic()
        status = "completed"

        async with traced_async_span(
            "pipeline.process_article",
            **{
                "article.id": article_id,
                "article.source": article_data.get("source", ""),
                "article.url": article_data.get("url", ""),
                "pipeline.max_iterations": settings.max_iterations,
            },
        ):
            try:
                final_state = await with_async_timeout(
                    self.app.ainvoke(initial_state),
                    timeout_s=deadline_s,
                    operation="pipeline.process_article",
                )

                result = {
                    "article_id": final_state["article_id"],
                    "summary": final_state.get("summary"),
                    "topics": final_state.get("topics", []),
                    "sentiment": final_state.get("sentiment"),
                    "quality_score": final_state.get("quality_score"),
                    "analyzed_content": final_state.get("analyzed_content"),
                    "iterations": final_state.get("iteration"),
                    "errors": final_state.get("errors", []),
                    "timestamp": final_state["timestamp"],
                }
                if result["errors"]:
                    status = "partial"
                log.info(
                    "pipeline.complete",
                    quality_score=result.get("quality_score"),
                    iterations=result.get("iterations"),
                    error_count=len(result["errors"]),
                )
                return result

            except Exception as exc:
                status = "failed"
                log.exception("pipeline.failed", error=str(exc))
                return {
                    "article_id": article_id,
                    "error": str(exc),
                    "error_type": type(exc).__name__,
                    "timestamp": _utc_now_iso(),
                }
            finally:
                duration = time.monotonic() - start
                metrics().pipeline_runs_total.labels(status=status).inc()
                metrics().pipeline_duration_seconds.labels(status=status).observe(duration)

    def visualize(self) -> str:
        """Generate a mermaid diagram of the pipeline."""
        return self.app.get_graph().draw_mermaid()
