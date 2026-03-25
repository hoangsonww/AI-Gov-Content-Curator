"""
Cost and budget management for the SynthoraAI orchestration layer.

Tracks per-model token usage, estimates costs from the PRICING table,
enforces daily spending limits, and recommends the cheapest provider
for a given task.
"""
from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import Optional

import structlog

from .types import PRICING, ExecutionPlan, ModelProvider

logger = structlog.get_logger(__name__)

# Default daily budget cap in USD
_DEFAULT_DAILY_BUDGET_USD: float = 10.0


class CostBudgetManager:
    """Thread-safe budget tracking and cost estimation.

    Usage::

        manager = CostBudgetManager(daily_budget_usd=5.0)
        cost = manager.estimate_cost("gemini-1.5-flash", input_tokens=500, output_tokens=200)
        if manager.can_afford(cost):
            manager.record_usage("gemini-1.5-flash", input_tokens=500, output_tokens=200, cost_usd=cost)

    Args:
        daily_budget_usd: Maximum USD spend permitted per calendar day (UTC).
    """

    def __init__(self, daily_budget_usd: float = _DEFAULT_DAILY_BUDGET_USD) -> None:
        if daily_budget_usd <= 0:
            raise ValueError(
                f"daily_budget_usd must be positive, got {daily_budget_usd}"
            )
        self._daily_budget_usd: float = daily_budget_usd
        self._lock: threading.Lock = threading.Lock()

        # Keyed by model identifier -> cumulative cost for the day
        self._daily_cost_by_model: dict[str, float] = {}
        # Keyed by model identifier -> cumulative token counts
        self._daily_tokens_by_model: dict[str, dict[str, int]] = {}
        self._daily_total_usd: float = 0.0
        self._reset_date: str = self._today_utc()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _today_utc() -> str:
        """Return the current UTC date as an ISO-8601 date string."""
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")

    def _maybe_reset(self) -> None:
        """Reset daily counters if the UTC date has advanced.

        Must be called while holding ``self._lock``.
        """
        today = self._today_utc()
        if today != self._reset_date:
            logger.info(
                "cost_budget.daily_reset",
                previous_date=self._reset_date,
                new_date=today,
                previous_total_usd=self._daily_total_usd,
            )
            self._daily_cost_by_model = {}
            self._daily_tokens_by_model = {}
            self._daily_total_usd = 0.0
            self._reset_date = today

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def estimate_cost(
        self,
        model: str,
        input_tokens: int = 0,
        output_tokens: int = 0,
        cached_tokens: int = 0,
    ) -> float:
        """Estimate the USD cost for a model call.

        Uses the :data:`~agentic_ai.orchestration.types.PRICING` table.
        Returns ``0.0`` for unknown models rather than raising.

        Args:
            model: Model identifier, e.g. ``"gemini-1.5-flash"``.
            input_tokens: Number of prompt tokens.
            output_tokens: Number of completion tokens.
            cached_tokens: Number of prompt-cache-read tokens (billed at a
                lower rate where available).

        Returns:
            Estimated cost in USD.
        """
        pricing = PRICING.get(model)
        if pricing is None:
            logger.warning("cost_budget.unknown_model", model=model)
            return 0.0

        input_rate = pricing.get("input", 0.0)
        output_rate = pricing.get("output", 0.0)
        cached_rate = pricing.get("cached", input_rate)

        cost = (
            (input_tokens / 1_000_000) * input_rate
            + (output_tokens / 1_000_000) * output_rate
            + (cached_tokens / 1_000_000) * cached_rate
        )
        return round(cost, 8)

    def can_afford(self, estimated_cost_usd: float) -> bool:
        """Check whether adding ``estimated_cost_usd`` would stay within the daily budget.

        Args:
            estimated_cost_usd: Cost to test against the remaining budget.

        Returns:
            ``True`` if the cost fits within the remaining daily allowance.
        """
        with self._lock:
            self._maybe_reset()
            remaining = self._daily_budget_usd - self._daily_total_usd
            affordable = estimated_cost_usd <= remaining
            if not affordable:
                logger.warning(
                    "cost_budget.budget_exceeded",
                    estimated=estimated_cost_usd,
                    remaining=remaining,
                    daily_budget=self._daily_budget_usd,
                )
            return affordable

    def record_usage(
        self,
        model: str,
        input_tokens: int = 0,
        output_tokens: int = 0,
        cached_tokens: int = 0,
        cost_usd: Optional[float] = None,
    ) -> float:
        """Record actual token usage and update daily cost accumulators.

        If ``cost_usd`` is omitted the method estimates the cost via
        :meth:`estimate_cost` before recording.

        Args:
            model: Model identifier.
            input_tokens: Prompt tokens consumed.
            output_tokens: Completion tokens generated.
            cached_tokens: Cached-prompt tokens read.
            cost_usd: Pre-computed cost; computed automatically when ``None``.

        Returns:
            The cost recorded (USD).
        """
        if cost_usd is None:
            cost_usd = self.estimate_cost(model, input_tokens, output_tokens, cached_tokens)

        with self._lock:
            self._maybe_reset()

            self._daily_total_usd += cost_usd

            self._daily_cost_by_model.setdefault(model, 0.0)
            self._daily_cost_by_model[model] += cost_usd

            token_bucket = self._daily_tokens_by_model.setdefault(
                model, {"input": 0, "output": 0, "cached": 0}
            )
            token_bucket["input"] += input_tokens
            token_bucket["output"] += output_tokens
            token_bucket["cached"] += cached_tokens

            logger.debug(
                "cost_budget.usage_recorded",
                model=model,
                cost_usd=cost_usd,
                daily_total=self._daily_total_usd,
            )

        return cost_usd

    def get_daily_usage(self) -> dict[str, object]:
        """Return a snapshot of today's usage statistics.

        Returns:
            Dictionary with keys: ``date``, ``total_usd``, ``budget_usd``,
            ``remaining_usd``, ``by_model`` (per-model cost and token breakdown).
        """
        with self._lock:
            self._maybe_reset()
            return {
                "date": self._reset_date,
                "total_usd": round(self._daily_total_usd, 6),
                "budget_usd": self._daily_budget_usd,
                "remaining_usd": round(
                    max(0.0, self._daily_budget_usd - self._daily_total_usd), 6
                ),
                "by_model": {
                    model: {
                        "cost_usd": round(cost, 6),
                        "tokens": dict(self._daily_tokens_by_model.get(model, {})),
                    }
                    for model, cost in self._daily_cost_by_model.items()
                },
            }

    def optimize_plan(self, plan: ExecutionPlan) -> ExecutionPlan:
        """Suggest a cost-optimised variant of an execution plan.

        Walks each step and, where the agent's model is expensive (i.e. not
        in the PRICING table or has an input rate above the median), annotates
        the step metadata with ``"suggested_model"`` pointing at the cheapest
        Gemini Flash variant.

        Args:
            plan: The :class:`~agentic_ai.orchestration.types.ExecutionPlan` to optimise.

        Returns:
            The same plan object with metadata hints added (no structural changes).
        """
        budget_models = [
            m for m, p in PRICING.items() if p.get("input", 999) <= 0.10
        ]
        for step in plan.steps:
            current_model = step.metadata.get("model")
            if current_model and current_model not in budget_models:
                step.metadata["suggested_model"] = "gemini-2.0-flash-lite"
                logger.debug(
                    "cost_budget.optimize_step",
                    step_id=step.step_id,
                    current_model=current_model,
                    suggested="gemini-2.0-flash-lite",
                )
        return plan

    def get_recommended_provider(
        self,
        required_capability: Optional[str] = None,
        max_cost_tier: str = "medium",
    ) -> ModelProvider:
        """Return the most cost-effective provider for a given context.

        Currently applies a simple heuristic: Google is recommended unless
        ``required_capability`` indicates supervision or escalation needs, in
        which case Anthropic is recommended.

        Args:
            required_capability: Capability string hint.
            max_cost_tier: Upper cost tier ceiling (``"low"``, ``"medium"``, ``"high"``).

        Returns:
            :class:`~agentic_ai.orchestration.types.ModelProvider` recommendation.
        """
        supervision_keywords = {"supervision", "escalation_handling", "quality_review"}
        if required_capability and required_capability in supervision_keywords:
            if max_cost_tier == "high":
                return ModelProvider.ANTHROPIC

        return ModelProvider.GOOGLE
