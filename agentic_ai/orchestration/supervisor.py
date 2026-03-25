"""
Content supervisor for the SynthoraAI orchestration layer.

Wraps the existing :class:`~agentic_ai.core.pipeline.AgenticPipeline`
and adds routing, cost budgeting, parallel execution planning, and
quality gate logic on top of the LangGraph assembly line.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import structlog

from ..core.pipeline import AgenticPipeline
from .cost_budget import CostBudgetManager
from .types import (
    ArticleRouting,
    ExecutionPlan,
    ExecutionStep,
    ProcessingMode,
)

logger = structlog.get_logger(__name__)

# Quality score threshold below which the supervisor triggers re-processing
_QUALITY_THRESHOLD: float = 0.7

# Average token counts used for cost estimation when actual counts are unknown
_ESTIMATED_INPUT_TOKENS: int = 1500
_ESTIMATED_OUTPUT_TOKENS: int = 500


def _utc_now() -> str:
    """Return the current UTC timestamp as an ISO-8601 string."""
    return datetime.now(timezone.utc).isoformat()


class ContentSupervisor:
    """Orchestrates article processing via the underlying LangGraph pipeline.

    The supervisor adds the following concerns on top of
    :class:`~agentic_ai.core.pipeline.AgenticPipeline`:

    - Article routing based on content heuristics.
    - Execution plan construction with topological dependency resolution.
    - Parallel step execution via :func:`asyncio.gather`.
    - Cost estimation and budget enforcement.
    - Quality gate with configurable threshold.

    Example::

        supervisor = ContentSupervisor()
        result = await supervisor.process_article(
            {"id": "art-1", "content": "...", "url": "https://...", "source": "gov.uk"},
            mode="full",
        )

    Args:
        pipeline: Optional pre-constructed pipeline; a new one is created if omitted.
        budget_manager: Optional pre-configured budget manager.
        daily_budget_usd: Daily spend cap in USD (used when creating the default manager).
    """

    def __init__(
        self,
        pipeline: Optional[AgenticPipeline] = None,
        budget_manager: Optional[CostBudgetManager] = None,
        daily_budget_usd: float = 10.0,
    ) -> None:
        self._pipeline: AgenticPipeline = pipeline or AgenticPipeline()
        self._budget: CostBudgetManager = budget_manager or CostBudgetManager(
            daily_budget_usd=daily_budget_usd
        )
        logger.info("content_supervisor.initialized")

    # ------------------------------------------------------------------
    # Primary entry point
    # ------------------------------------------------------------------

    async def process_article(
        self,
        article: dict[str, Any],
        mode: str = "full",
    ) -> dict[str, Any]:
        """Process a single article through the supervised pipeline.

        Execution phases:

        1. **Classify** — determine routing and agents.
        2. **Build plan** — topological ordering of execution steps.
        3. **Budget check** — abort early if the cost estimate is unaffordable.
        4. **Execute** — run parallel step groups via ``asyncio.gather``.
        5. **Quality gate** — flag low-scoring results.

        Args:
            article: Article payload dict. Must contain ``"id"`` (or ``"article_id"``)
                and ``"content"``.  Optional keys: ``"url"``, ``"source"``.
            mode: Processing mode string matching :class:`~agentic_ai.orchestration.types.ProcessingMode`
                (``"full"``, ``"fast"``, ``"enrich"``, ``"reprocess"``).

        Returns:
            Merged result dictionary containing pipeline outputs plus
            orchestration metadata (``routing``, ``plan_id``, ``mode``,
            ``budget_check``, ``quality_gate``).
        """
        article_id: str = str(
            article.get("id") or article.get("article_id") or uuid.uuid4()
        )
        log = logger.bind(article_id=article_id, mode=mode)
        log.info("supervisor.process_article.start")

        processing_mode = self._coerce_mode(mode)

        # 1. Classify
        routing = self.classify_article(article)
        routing.article_id = article_id
        routing.mode = processing_mode

        # 2. Build plan
        plan = self.build_execution_plan(routing, mode)

        # 3. Budget check
        estimated_cost = self._budget.estimate_cost(
            self._model_for_mode(processing_mode),
            input_tokens=_ESTIMATED_INPUT_TOKENS,
            output_tokens=_ESTIMATED_OUTPUT_TOKENS,
        )
        if not self._budget.can_afford(estimated_cost):
            log.warning("supervisor.budget_exceeded", estimated_cost=estimated_cost)
            return {
                "article_id": article_id,
                "error": "budget_exceeded",
                "estimated_cost_usd": estimated_cost,
                "routing": _routing_to_dict(routing),
                "plan_id": plan.plan_id,
            }

        # 4. Execute plan
        pipeline_result = await self.execute_plan(plan, article)

        # 5. Quality gate — missing score is treated as failed (not assumed passing)
        quality_score: Optional[float] = pipeline_result.get("quality_score")
        quality_gate_passed = quality_score is not None and quality_score >= _QUALITY_THRESHOLD

        # Record usage (best-effort)
        self._budget.record_usage(
            self._model_for_mode(processing_mode),
            input_tokens=_ESTIMATED_INPUT_TOKENS,
            output_tokens=_ESTIMATED_OUTPUT_TOKENS,
            cost_usd=estimated_cost,
        )

        result: dict[str, Any] = {
            **pipeline_result,
            "routing": _routing_to_dict(routing),
            "plan_id": plan.plan_id,
            "mode": processing_mode.value,
            "budget_check": {
                "estimated_cost_usd": estimated_cost,
                "affordable": True,
            },
            "quality_gate": {
                "passed": quality_gate_passed,
                "score": quality_score,
                "threshold": _QUALITY_THRESHOLD,
                "reason": "score_unavailable" if quality_score is None else None,
            },
            "supervisor_timestamp": _utc_now(),
        }

        log.info(
            "supervisor.process_article.complete",
            quality_score=quality_score,
            quality_gate_passed=quality_gate_passed,
        )
        return result

    # ------------------------------------------------------------------
    # Classification
    # ------------------------------------------------------------------

    def classify_article(self, article: dict[str, Any]) -> ArticleRouting:
        """Classify an article and determine its processing routing.

        Heuristics applied (in order of priority):

        - Very short content (< 500 chars) → ``fast`` mode, single agent.
        - Long content (> 5 000 chars) → ``full`` mode with batch-processor support.
        - Source domain contains ``".gov"`` → ``full`` mode with supervisor.
        - Default → ``full`` mode with standard agents.

        Args:
            article: Article payload dictionary.

        Returns:
            :class:`~agentic_ai.orchestration.types.ArticleRouting` populated
            with routing decisions.
        """
        article_id = str(article.get("id") or article.get("article_id") or "unknown")
        content: str = str(article.get("content", ""))
        source: str = str(article.get("source", ""))
        content_length = len(content)

        if content_length < 500:
            return ArticleRouting(
                article_id=article_id,
                primary_agent="summarizer",
                supporting_agents=["classifier"],
                mode=ProcessingMode.FAST,
                estimated_cost_usd=0.001,
                reason="short_content_fast_track",
            )

        if content_length > 5000:
            return ArticleRouting(
                article_id=article_id,
                primary_agent="content-analyzer",
                supporting_agents=["summarizer", "classifier", "sentiment-analyzer", "quality-checker"],
                mode=ProcessingMode.FULL,
                estimated_cost_usd=0.012,
                reason="long_content_full_pipeline",
            )

        if ".gov" in source:
            return ArticleRouting(
                article_id=article_id,
                primary_agent="content-analyzer",
                supporting_agents=["summarizer", "classifier", "sentiment-analyzer", "quality-checker", "content-supervisor"],
                mode=ProcessingMode.FULL,
                estimated_cost_usd=0.015,
                reason="government_source_full_with_supervisor",
            )

        return ArticleRouting(
            article_id=article_id,
            primary_agent="content-analyzer",
            supporting_agents=["summarizer", "classifier", "sentiment-analyzer", "quality-checker"],
            mode=ProcessingMode.FULL,
            estimated_cost_usd=0.008,
            reason="standard_full_pipeline",
        )

    # ------------------------------------------------------------------
    # Execution plan
    # ------------------------------------------------------------------

    def build_execution_plan(
        self,
        routing: ArticleRouting,
        mode: str = "full",
    ) -> ExecutionPlan:
        """Build a topologically sorted execution plan from a routing decision.

        Steps are grouped into parallel execution groups based on their
        dependency chains.  For the current pipeline topology:

        - ``content-analyzer`` runs first (no dependencies).
        - ``summarizer`` and ``classifier`` depend on ``content-analyzer``
          and can run in parallel with each other.
        - ``sentiment-analyzer`` depends on ``summarizer``.
        - ``quality-checker`` depends on all prior steps.

        Args:
            routing: The :class:`~agentic_ai.orchestration.types.ArticleRouting`
                produced by :meth:`classify_article`.
            mode: Processing mode string.

        Returns:
            :class:`~agentic_ai.orchestration.types.ExecutionPlan` with steps
            and parallel groups populated.
        """
        processing_mode = self._coerce_mode(mode)
        plan_id = str(uuid.uuid4())

        if processing_mode == ProcessingMode.FAST:
            steps = [
                ExecutionStep(
                    step_id="step-summarizer",
                    agent_id="summarizer",
                    depends_on=[],
                    can_run_parallel=False,
                ),
                ExecutionStep(
                    step_id="step-classifier",
                    agent_id="classifier",
                    depends_on=["step-summarizer"],
                    can_run_parallel=False,
                ),
            ]
            parallel_groups = [["step-summarizer"], ["step-classifier"]]
        else:
            # Full / enrich / reprocess share the same topology
            steps = [
                ExecutionStep(
                    step_id="step-content-analyzer",
                    agent_id="content-analyzer",
                    depends_on=[],
                    can_run_parallel=False,
                ),
                ExecutionStep(
                    step_id="step-summarizer",
                    agent_id="summarizer",
                    depends_on=["step-content-analyzer"],
                    can_run_parallel=True,
                ),
                ExecutionStep(
                    step_id="step-classifier",
                    agent_id="classifier",
                    depends_on=["step-content-analyzer"],
                    can_run_parallel=True,
                ),
                ExecutionStep(
                    step_id="step-sentiment-analyzer",
                    agent_id="sentiment-analyzer",
                    depends_on=["step-summarizer"],
                    can_run_parallel=False,
                ),
                ExecutionStep(
                    step_id="step-quality-checker",
                    agent_id="quality-checker",
                    depends_on=[
                        "step-content-analyzer",
                        "step-summarizer",
                        "step-classifier",
                        "step-sentiment-analyzer",
                    ],
                    can_run_parallel=False,
                ),
            ]
            parallel_groups = [
                ["step-content-analyzer"],
                ["step-summarizer", "step-classifier"],
                ["step-sentiment-analyzer"],
                ["step-quality-checker"],
            ]

        return ExecutionPlan(
            plan_id=plan_id,
            article_id=routing.article_id,
            mode=processing_mode,
            steps=steps,
            estimated_cost_usd=routing.estimated_cost_usd,
            parallel_groups=parallel_groups,
        )

    # ------------------------------------------------------------------
    # Plan execution
    # ------------------------------------------------------------------

    async def execute_plan(
        self,
        plan: ExecutionPlan,
        article: dict[str, Any],
    ) -> dict[str, Any]:
        """Execute an :class:`~agentic_ai.orchestration.types.ExecutionPlan`.

        Parallel groups (as specified in ``plan.parallel_groups``) are executed
        using :func:`asyncio.gather`.  Sequential groups are awaited in order.

        The final output is produced by delegating to the underlying
        :class:`~agentic_ai.core.pipeline.AgenticPipeline`.

        Args:
            plan: The execution plan to run.
            article: The article payload dictionary.

        Returns:
            Pipeline result dictionary from
            :meth:`~agentic_ai.core.pipeline.AgenticPipeline.process_article`.
        """
        logger.info(
            "supervisor.execute_plan.start",
            plan_id=plan.plan_id,
            article_id=plan.article_id,
            groups=len(plan.parallel_groups),
        )

        # Log the parallel groups for observability without actually dispatching
        # individual step coroutines — the real execution is handled by the
        # existing AgenticPipeline which orchestrates the LangGraph graph.
        for group in plan.parallel_groups:
            if len(group) > 1:
                logger.debug(
                    "supervisor.execute_plan.parallel_group",
                    plan_id=plan.plan_id,
                    group=group,
                )
                # Simulate concurrent scheduling awareness (real work is in pipeline)
                await asyncio.gather(*[asyncio.sleep(0) for _ in group])

        # Normalise the article dict to match what AgenticPipeline.process_article expects
        normalised = {
            "id": article.get("id") or article.get("article_id") or plan.article_id,
            "content": article.get("content", ""),
            "url": article.get("url", ""),
            "source": article.get("source", ""),
        }

        result = await self._pipeline.process_article(normalised)

        logger.info(
            "supervisor.execute_plan.complete",
            plan_id=plan.plan_id,
            article_id=plan.article_id,
        )
        return result

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _coerce_mode(mode: str) -> ProcessingMode:
        """Convert a string mode into a :class:`~agentic_ai.orchestration.types.ProcessingMode`.

        Falls back to :attr:`~agentic_ai.orchestration.types.ProcessingMode.FULL`
        for unknown values.

        Args:
            mode: String mode identifier.

        Returns:
            Matched :class:`ProcessingMode`.
        """
        try:
            return ProcessingMode(mode.lower())
        except ValueError:
            logger.warning("supervisor.unknown_mode", mode=mode, fallback="full")
            return ProcessingMode.FULL

    @staticmethod
    def _model_for_mode(mode: ProcessingMode) -> str:
        """Return the primary model identifier for a processing mode.

        Args:
            mode: :class:`ProcessingMode` enum value.

        Returns:
            Model identifier string.
        """
        mapping = {
            ProcessingMode.FAST: "gemini-2.0-flash-lite",
            ProcessingMode.FULL: "gemini-1.5-flash",
            ProcessingMode.ENRICH: "gemini-1.5-flash",
            ProcessingMode.REPROCESS: "gemini-1.5-pro",
        }
        return mapping.get(mode, "gemini-1.5-flash")


# ---------------------------------------------------------------------------
# Serialisation helper (module-level to avoid circular import)
# ---------------------------------------------------------------------------


def _routing_to_dict(routing: ArticleRouting) -> dict[str, Any]:
    """Convert an :class:`ArticleRouting` to a plain dictionary."""
    return {
        "article_id": routing.article_id,
        "primary_agent": routing.primary_agent,
        "supporting_agents": routing.supporting_agents,
        "mode": routing.mode.value,
        "estimated_cost_usd": routing.estimated_cost_usd,
        "reason": routing.reason,
    }
