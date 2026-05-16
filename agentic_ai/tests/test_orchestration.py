"""
Tests for agentic_ai.orchestration — AgentRegistry, CostBudgetManager,
DeadLetterQueue, ErrorRecoveryEngine, ArticleBatchProcessor, and
ContentSupervisor.

All tests are hermetic: no network, no real API keys, no external services.
The AgenticPipeline is stubbed at the method level exactly like test_pipeline.py.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

# ---------------------------------------------------------------------------
# Helpers shared across test classes
# ---------------------------------------------------------------------------


def _make_article(
    *,
    content: str = "A standard government article body.",
    article_id: str = "art-001",
    url: str = "https://example.gov/news/1",
    source: str = "example.gov",
    priority: int = 0,
) -> dict[str, Any]:
    return {
        "id": article_id,
        "content": content,
        "url": url,
        "source": source,
        "priority": priority,
    }


def _build_pipeline_stub(monkeypatch: pytest.MonkeyPatch, *, quality_score: float = 0.9) -> Any:
    """Return a fully-stubbed AgenticPipeline (same technique as test_pipeline.py)."""
    from langchain_core.language_models.fake_chat_models import FakeListChatModel

    monkeypatch.setattr(
        "agentic_ai.agents.base_agent.BaseAgent._get_default_llm",
        lambda self: FakeListChatModel(responses=["{}"]),
    )

    from agentic_ai.core.pipeline import AgenticPipeline

    pipeline = AgenticPipeline()

    pipeline.content_analyzer.analyze = lambda content, metadata=None: {  # type: ignore[method-assign]
        "main_topic": "policy",
        "entities": {"people": []},
    }
    pipeline.summarizer.summarize = lambda content, analyzed_content=None: "Summary."  # type: ignore[method-assign]
    pipeline.classifier.classify = lambda content, summary=None: ["policy"]  # type: ignore[method-assign]
    pipeline.sentiment_analyzer.analyze_sentiment = lambda content, summary=None: {  # type: ignore[method-assign]
        "overall_sentiment": "neutral",
        "sentiment_score": 0.0,
    }
    pipeline.quality_checker.check_quality = lambda **kwargs: {  # type: ignore[method-assign]
        "score": quality_score,
        "passed": quality_score >= 0.7,
    }
    return pipeline


# ===========================================================================
# AgentRegistry
# ===========================================================================


class TestAgentRegistry:
    def test_register_and_get(self) -> None:
        from agentic_ai.orchestration import AgentDefinition, AgentRegistry, CostTier, ModelProvider

        registry = AgentRegistry()
        defn = AgentDefinition(
            agent_id="test-agent",
            display_name="Test Agent",
            provider=ModelProvider.GOOGLE,
            model="gemini-1.5-flash",
            capabilities=["summarization"],
            cost_tier=CostTier.LOW,
        )
        registry.register(defn)
        result = registry.get("test-agent")
        assert result is not None
        assert result.agent_id == "test-agent"
        assert result.display_name == "Test Agent"

    def test_get_missing_returns_none(self) -> None:
        from agentic_ai.orchestration import AgentRegistry

        registry = AgentRegistry()
        assert registry.get("nonexistent") is None

    def test_remove_existing_returns_true(self) -> None:
        from agentic_ai.orchestration import AgentDefinition, AgentRegistry, CostTier, ModelProvider

        registry = AgentRegistry()
        defn = AgentDefinition(
            agent_id="to-remove",
            display_name="Remove Me",
            provider=ModelProvider.ANTHROPIC,
            model="claude-sonnet-4-6",
            cost_tier=CostTier.HIGH,
        )
        registry.register(defn)
        assert registry.remove("to-remove") is True
        assert registry.get("to-remove") is None

    def test_remove_missing_returns_false(self) -> None:
        from agentic_ai.orchestration import AgentRegistry

        registry = AgentRegistry()
        assert registry.remove("ghost") is False

    def test_list_all_returns_snapshot(self) -> None:
        from agentic_ai.orchestration import AgentRegistry

        registry = AgentRegistry.register_defaults()
        agents = registry.list_all()
        assert len(agents) == 7
        ids = {a.agent_id for a in agents}
        assert "content-analyzer" in ids
        assert "content-supervisor" in ids

    def test_list_by_capability(self) -> None:
        from agentic_ai.orchestration import AgentRegistry

        registry = AgentRegistry.register_defaults()
        agents = registry.list_by_capability("summarization")
        assert len(agents) >= 1
        assert all("summarization" in a.capabilities for a in agents)

    def test_list_by_capability_no_match_empty(self) -> None:
        from agentic_ai.orchestration import AgentRegistry

        registry = AgentRegistry()
        assert registry.list_by_capability("unicorn_detection") == []

    def test_list_by_provider(self) -> None:
        from agentic_ai.orchestration import AgentRegistry, ModelProvider

        registry = AgentRegistry.register_defaults()
        anthropic_agents = registry.list_by_provider(ModelProvider.ANTHROPIC)
        assert len(anthropic_agents) >= 1
        assert all(a.provider == ModelProvider.ANTHROPIC for a in anthropic_agents)

    def test_get_fallback_excludes_failed_agent(self) -> None:
        from agentic_ai.orchestration import AgentRegistry

        registry = AgentRegistry.register_defaults()
        fallback = registry.get_fallback("summarizer")
        assert fallback is not None
        assert fallback.agent_id != "summarizer"

    def test_get_fallback_with_required_capability(self) -> None:
        from agentic_ai.orchestration import AgentRegistry

        registry = AgentRegistry.register_defaults()
        # No agent other than "summarizer" has "summarization"; fallback should still find one
        fallback = registry.get_fallback("batch-processor", required_capability="summarization")
        assert fallback is not None
        assert "summarization" in fallback.capabilities

    def test_get_fallback_prefers_low_cost_tier(self) -> None:
        from agentic_ai.orchestration import AgentRegistry, CostTier

        registry = AgentRegistry.register_defaults()
        # content-supervisor is HIGH cost; fallback for it should prefer LOW/MEDIUM
        fallback = registry.get_fallback("content-supervisor")
        assert fallback is not None
        assert fallback.cost_tier in (CostTier.LOW, CostTier.MEDIUM)

    def test_get_fallback_no_candidates_returns_none(self) -> None:
        from agentic_ai.orchestration import AgentDefinition, AgentRegistry, CostTier, ModelProvider

        registry = AgentRegistry()
        registry.register(
            AgentDefinition(
                agent_id="solo",
                display_name="Solo",
                provider=ModelProvider.GOOGLE,
                model="gemini-1.5-flash",
                cost_tier=CostTier.LOW,
            )
        )
        # Only one agent; excluding it leaves no candidates.
        assert registry.get_fallback("solo") is None

    def test_register_defaults_factory(self) -> None:
        from agentic_ai.orchestration import AgentRegistry

        r1 = AgentRegistry.register_defaults()
        r2 = AgentRegistry.register_defaults()
        # Each call returns an independent registry
        assert r1 is not r2
        assert len(r1.list_all()) == len(r2.list_all())

    def test_register_overwrites_existing(self) -> None:
        from agentic_ai.orchestration import AgentDefinition, AgentRegistry, CostTier, ModelProvider

        registry = AgentRegistry()
        defn_v1 = AgentDefinition(
            agent_id="overwrite-me",
            display_name="V1",
            provider=ModelProvider.GOOGLE,
            model="gemini-1.5-flash",
            cost_tier=CostTier.LOW,
        )
        defn_v2 = AgentDefinition(
            agent_id="overwrite-me",
            display_name="V2",
            provider=ModelProvider.ANTHROPIC,
            model="claude-haiku-4-5",
            cost_tier=CostTier.MEDIUM,
        )
        registry.register(defn_v1)
        registry.register(defn_v2)
        result = registry.get("overwrite-me")
        assert result is not None
        assert result.display_name == "V2"
        assert result.provider == ModelProvider.ANTHROPIC


# ===========================================================================
# CostBudgetManager
# ===========================================================================


class TestCostBudgetManager:
    def test_estimate_cost_known_model(self) -> None:
        from agentic_ai.orchestration import CostBudgetManager

        manager = CostBudgetManager(daily_budget_usd=10.0)
        cost = manager.estimate_cost("gemini-1.5-flash", input_tokens=1_000_000, output_tokens=0)
        assert cost == pytest.approx(0.075, rel=1e-6)

    def test_estimate_cost_unknown_model_returns_zero(self) -> None:
        from agentic_ai.orchestration import CostBudgetManager

        manager = CostBudgetManager()
        assert manager.estimate_cost("unknown-model-xyz", input_tokens=100) == 0.0

    def test_estimate_cost_with_cached_tokens(self) -> None:
        from agentic_ai.orchestration import CostBudgetManager

        manager = CostBudgetManager()
        cost = manager.estimate_cost(
            "gemini-1.5-flash",
            input_tokens=0,
            output_tokens=0,
            cached_tokens=1_000_000,
        )
        # cached rate for gemini-1.5-flash is 0.01875 per 1M
        assert cost == pytest.approx(0.01875, rel=1e-6)

    def test_can_afford_within_budget(self) -> None:
        from agentic_ai.orchestration import CostBudgetManager

        manager = CostBudgetManager(daily_budget_usd=1.0)
        assert manager.can_afford(0.50) is True

    def test_can_afford_exactly_at_limit(self) -> None:
        from agentic_ai.orchestration import CostBudgetManager

        manager = CostBudgetManager(daily_budget_usd=1.0)
        assert manager.can_afford(1.0) is True

    def test_can_afford_exceeds_budget(self) -> None:
        from agentic_ai.orchestration import CostBudgetManager

        manager = CostBudgetManager(daily_budget_usd=1.0)
        assert manager.can_afford(1.01) is False

    def test_can_afford_after_spending(self) -> None:
        from agentic_ai.orchestration import CostBudgetManager

        manager = CostBudgetManager(daily_budget_usd=1.0)
        manager.record_usage("gemini-1.5-flash", cost_usd=0.80)
        assert manager.can_afford(0.21) is False
        assert manager.can_afford(0.20) is True

    def test_maybe_reset_zeroes_counters_on_new_day(self) -> None:
        from agentic_ai.orchestration import CostBudgetManager

        manager = CostBudgetManager(daily_budget_usd=5.0)
        manager.record_usage("gemini-1.5-flash", cost_usd=2.0)
        # Force a stale reset date so the next locked access rolls the day.
        manager._reset_date = "2000-01-01"
        usage = manager.get_daily_usage()
        assert usage["total_usd"] == 0.0
        assert usage["by_model"] == {}

    def test_record_usage_accumulates(self) -> None:
        from agentic_ai.orchestration import CostBudgetManager

        manager = CostBudgetManager()
        manager.record_usage("gemini-1.5-flash", input_tokens=100, output_tokens=50, cost_usd=0.01)
        manager.record_usage("gemini-1.5-flash", input_tokens=200, output_tokens=100, cost_usd=0.02)
        usage = manager.get_daily_usage()
        assert usage["total_usd"] == pytest.approx(0.03, rel=1e-6)
        by_model = usage["by_model"]
        assert "gemini-1.5-flash" in by_model
        assert by_model["gemini-1.5-flash"]["tokens"]["input"] == 300
        assert by_model["gemini-1.5-flash"]["tokens"]["output"] == 150

    def test_record_usage_auto_estimates_when_cost_omitted(self) -> None:
        from agentic_ai.orchestration import CostBudgetManager

        manager = CostBudgetManager()
        recorded = manager.record_usage("gemini-1.5-flash", input_tokens=1_000_000, output_tokens=0)
        # Should match estimate_cost directly
        expected = manager.estimate_cost(
            "gemini-1.5-flash", input_tokens=1_000_000, output_tokens=0
        )
        assert recorded == pytest.approx(expected, rel=1e-6)

    def test_get_daily_usage_shape(self) -> None:
        from agentic_ai.orchestration import CostBudgetManager

        manager = CostBudgetManager(daily_budget_usd=5.0)
        usage = manager.get_daily_usage()
        assert "date" in usage
        assert "total_usd" in usage
        assert "budget_usd" in usage
        assert "remaining_usd" in usage
        assert "by_model" in usage
        assert usage["budget_usd"] == 5.0
        assert usage["remaining_usd"] == 5.0

    def test_invalid_budget_raises(self) -> None:
        from agentic_ai.orchestration import CostBudgetManager

        with pytest.raises(ValueError, match="positive"):
            CostBudgetManager(daily_budget_usd=0.0)

        with pytest.raises(ValueError, match="positive"):
            CostBudgetManager(daily_budget_usd=-1.0)

    def test_optimize_plan_annotates_expensive_steps(self) -> None:
        from agentic_ai.orchestration import (
            CostBudgetManager,
            ExecutionPlan,
            ExecutionStep,
            ProcessingMode,
        )

        manager = CostBudgetManager()
        step = ExecutionStep(
            step_id="s1",
            agent_id="content-supervisor",
            metadata={"model": "claude-opus-4-6"},
        )
        plan = ExecutionPlan(
            plan_id="p1",
            article_id="art-1",
            mode=ProcessingMode.FULL,
            steps=[step],
        )
        result = manager.optimize_plan(plan)
        # The expensive claude model should get a suggested_model hint
        assert result.steps[0].metadata.get("suggested_model") == "gemini-2.0-flash-lite"

    def test_optimize_plan_leaves_cheap_steps_untouched(self) -> None:
        from agentic_ai.orchestration import (
            CostBudgetManager,
            ExecutionPlan,
            ExecutionStep,
            ProcessingMode,
        )

        manager = CostBudgetManager()
        step = ExecutionStep(
            step_id="s1",
            agent_id="classifier",
            metadata={"model": "gemini-2.0-flash-lite"},
        )
        plan = ExecutionPlan(
            plan_id="p2",
            article_id="art-2",
            mode=ProcessingMode.FAST,
            steps=[step],
        )
        result = manager.optimize_plan(plan)
        assert "suggested_model" not in result.steps[0].metadata

    def test_get_recommended_provider_default_is_google(self) -> None:
        from agentic_ai.orchestration import CostBudgetManager, ModelProvider

        manager = CostBudgetManager()
        provider = manager.get_recommended_provider()
        assert provider == ModelProvider.GOOGLE

    def test_get_recommended_provider_supervision_high_tier(self) -> None:
        from agentic_ai.orchestration import CostBudgetManager, ModelProvider

        manager = CostBudgetManager()
        provider = manager.get_recommended_provider(
            required_capability="supervision", max_cost_tier="high"
        )
        assert provider == ModelProvider.ANTHROPIC

    def test_get_recommended_provider_supervision_non_high_falls_back_to_google(self) -> None:
        from agentic_ai.orchestration import CostBudgetManager, ModelProvider

        manager = CostBudgetManager()
        provider = manager.get_recommended_provider(
            required_capability="supervision", max_cost_tier="medium"
        )
        assert provider == ModelProvider.GOOGLE


# ===========================================================================
# DeadLetterQueue
# ===========================================================================


class TestDeadLetterQueue:
    def test_add_and_get(self) -> None:
        from agentic_ai.orchestration import DeadLetterQueue

        dlq = DeadLetterQueue()
        entry_id = dlq.add(
            article_id="art-fail-1",
            failure_reason="max_iterations_exceeded",
            original_payload={"content": "body"},
        )
        entry = dlq.get(entry_id)
        assert entry is not None
        assert entry["article_id"] == "art-fail-1"
        assert entry["failure_reason"] == "max_iterations_exceeded"
        assert entry["replay_count"] == 0
        assert entry["last_replayed_at"] is None

    def test_get_missing_returns_none(self) -> None:
        from agentic_ai.orchestration import DeadLetterQueue

        dlq = DeadLetterQueue()
        assert dlq.get("00000000-0000-0000-0000-000000000000") is None

    def test_list_all_returns_all_entries(self) -> None:
        from agentic_ai.orchestration import DeadLetterQueue

        dlq = DeadLetterQueue()
        dlq.add("art-1", "reason-a")
        dlq.add("art-2", "reason-b")
        entries = dlq.list_all()
        assert len(entries) == 2
        article_ids = {e["article_id"] for e in entries}
        assert article_ids == {"art-1", "art-2"}

    def test_purge_removes_all_and_returns_count(self) -> None:
        from agentic_ai.orchestration import DeadLetterQueue

        dlq = DeadLetterQueue()
        dlq.add("a1", "r1")
        dlq.add("a2", "r2")
        dlq.add("a3", "r3")
        removed = dlq.purge()
        assert removed == 3
        assert dlq.list_all() == []

    def test_purge_empty_queue_returns_zero(self) -> None:
        from agentic_ai.orchestration import DeadLetterQueue

        dlq = DeadLetterQueue()
        assert dlq.purge() == 0

    def test_stats_on_empty_queue(self) -> None:
        from agentic_ai.orchestration import DeadLetterQueue

        dlq = DeadLetterQueue()
        stats = dlq.stats()
        assert stats["total"] == 0
        assert stats["replay_pending"] == 0
        assert stats["replayed"] == 0
        assert stats["oldest_created_at"] is None

    def test_stats_counts_correctly(self) -> None:
        from agentic_ai.orchestration import DeadLetterQueue

        dlq = DeadLetterQueue()
        eid1 = dlq.add("a1", "r1")
        dlq.add("a2", "r2")
        # Manually bump replay_count on eid1 to simulate a prior replay
        with dlq._lock:
            dlq._entries[eid1].replay_count = 1

        stats = dlq.stats()
        assert stats["total"] == 2
        assert stats["replayed"] == 1
        assert stats["replay_pending"] == 1

    async def test_replay_success(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from agentic_ai.orchestration import DeadLetterQueue

        pipeline = _build_pipeline_stub(monkeypatch, quality_score=0.9)
        supervisor = _make_supervisor(pipeline)
        dlq = DeadLetterQueue()
        entry_id = dlq.add(
            article_id="art-replay",
            failure_reason="prior_error",
            original_payload=_make_article(article_id="art-replay"),
        )
        result = await dlq.replay(entry_id, supervisor=supervisor)
        assert result["success"] is True
        assert result["entry_id"] == entry_id
        assert result["replay_count"] == 1
        assert "result" in result

        # replay_count persisted in the entry
        entry = dlq.get(entry_id)
        assert entry is not None
        assert entry["replay_count"] == 1
        assert entry["last_replayed_at"] is not None

    async def test_replay_failure_records_error(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from agentic_ai.orchestration import DeadLetterQueue

        _build_pipeline_stub(monkeypatch, quality_score=0.9)
        # Supervisor whose process_article always raises
        supervisor = MagicMock()
        supervisor.process_article = AsyncMock(side_effect=RuntimeError("kaboom"))

        dlq = DeadLetterQueue()
        entry_id = dlq.add("art-fail", "previous_error", original_payload={"content": "body"})
        result = await dlq.replay(entry_id, supervisor=supervisor)
        assert result["success"] is False
        assert "error" in result
        assert result["replay_count"] == 1

    async def test_replay_missing_entry_raises_key_error(self) -> None:
        from agentic_ai.orchestration import DeadLetterQueue

        dlq = DeadLetterQueue()
        supervisor = MagicMock()
        with pytest.raises(KeyError):
            await dlq.replay("no-such-id", supervisor=supervisor)

    def test_entry_to_dict_shape(self) -> None:
        from agentic_ai.orchestration import DeadLetterQueue

        dlq = DeadLetterQueue()
        entry_id = dlq.add("art-x", "reason-x", error_context={"k": "v"})
        d = dlq.get(entry_id)
        assert d is not None
        expected_keys = {
            "entry_id",
            "article_id",
            "failure_reason",
            "error_context",
            "original_payload",
            "created_at",
            "replay_count",
            "last_replayed_at",
        }
        assert set(d.keys()) == expected_keys
        assert d["error_context"] == {"k": "v"}


# ===========================================================================
# ErrorRecoveryEngine
# ===========================================================================


def _make_agent_error(
    error_type: Any,
    *,
    agent_id: str = "test-agent",
    retryable: bool = True,
    context: dict[str, Any] | None = None,
) -> Any:
    from agentic_ai.orchestration import AgentError

    return AgentError(
        error_type=error_type,
        agent_id=agent_id,
        message="test error",
        retryable=retryable,
        context=context or {},
    )


class TestErrorRecoveryEngine:
    async def test_recover_rate_limited_returns_retry(self) -> None:
        from agentic_ai.orchestration import AgentErrorType, ErrorRecoveryEngine

        engine = ErrorRecoveryEngine()
        error = _make_agent_error(AgentErrorType.RATE_LIMITED, context={"attempt": 0})
        result = await engine.recover(error)
        assert result["action"] == "retry"
        assert result["agent_id"] == "test-agent"

    async def test_recover_context_overflow_truncates(self) -> None:
        from agentic_ai.orchestration import AgentErrorType, ErrorRecoveryEngine

        engine = ErrorRecoveryEngine()
        error = _make_agent_error(AgentErrorType.CONTEXT_OVERFLOW)
        result = await engine.recover(error)
        assert result["action"] == "retry"
        assert result["modifications"]["truncate_content"] is True

    async def test_recover_hallucination_escalates(self) -> None:
        from agentic_ai.orchestration import AgentErrorType, ErrorRecoveryEngine

        engine = ErrorRecoveryEngine()
        error = _make_agent_error(AgentErrorType.HALLUCINATION_DETECTED)
        result = await engine.recover(error)
        assert result["action"] == "escalate"
        assert result["agent_id"] == "content-supervisor"

    async def test_recover_budget_exceeded_aborts(self) -> None:
        from agentic_ai.orchestration import AgentErrorType, ErrorRecoveryEngine

        engine = ErrorRecoveryEngine()
        error = _make_agent_error(AgentErrorType.BUDGET_EXCEEDED)
        result = await engine.recover(error)
        assert result["action"] == "abort"

    async def test_recover_circular_handoff_terminates(self) -> None:
        from agentic_ai.orchestration import AgentErrorType, ErrorRecoveryEngine

        engine = ErrorRecoveryEngine()
        error = _make_agent_error(AgentErrorType.CIRCULAR_HANDOFF)
        result = await engine.recover(error)
        assert result["action"] == "terminate"

    async def test_recover_provider_unavailable_fails_over(self) -> None:
        from agentic_ai.orchestration import AgentErrorType, ErrorRecoveryEngine, ModelProvider

        engine = ErrorRecoveryEngine()
        error = _make_agent_error(
            AgentErrorType.PROVIDER_UNAVAILABLE,
            context={"provider": ModelProvider.GOOGLE},
        )
        result = await engine.recover(error)
        assert result["action"] == "failover"
        assert result["provider"] == ModelProvider.ANTHROPIC

    async def test_recover_provider_unavailable_anthropic_failover_to_google(self) -> None:
        from agentic_ai.orchestration import AgentErrorType, ErrorRecoveryEngine, ModelProvider

        engine = ErrorRecoveryEngine()
        error = _make_agent_error(
            AgentErrorType.PROVIDER_UNAVAILABLE,
            context={"provider": ModelProvider.ANTHROPIC},
        )
        result = await engine.recover(error)
        assert result["provider"] == ModelProvider.GOOGLE

    async def test_recover_embedding_failure_first_attempt_retries(self) -> None:
        from agentic_ai.orchestration import AgentErrorType, ErrorRecoveryEngine

        engine = ErrorRecoveryEngine()
        error = _make_agent_error(AgentErrorType.EMBEDDING_FAILURE, context={"attempt": 0})
        result = await engine.recover(error)
        assert result["action"] == "retry"

    async def test_recover_embedding_failure_second_attempt_degrades(self) -> None:
        from agentic_ai.orchestration import AgentErrorType, ErrorRecoveryEngine

        engine = ErrorRecoveryEngine()
        error = _make_agent_error(AgentErrorType.EMBEDDING_FAILURE, context={"attempt": 1})
        result = await engine.recover(error)
        assert result["action"] == "degrade"
        assert result["fallback"] == "keyword_search"

    async def test_recover_generic_non_retryable_returns_abort(self) -> None:
        from agentic_ai.orchestration import AgentErrorType, ErrorRecoveryEngine

        engine = ErrorRecoveryEngine()
        # Drop the dedicated handler so the error falls through to the
        # generic recovery path; a non-retryable error there must abort.
        non_retryable = _make_agent_error(AgentErrorType.TOOL_FAILURE, retryable=False)
        engine._strategies.pop(AgentErrorType.TOOL_FAILURE)
        result = await engine.recover(non_retryable)
        assert result["action"] == "abort"

    async def test_recover_generic_retryable_returns_retry(self) -> None:
        from agentic_ai.orchestration import AgentErrorType, ErrorRecoveryEngine

        engine = ErrorRecoveryEngine()
        # Drop the dedicated handler so a retryable error falls through to
        # the generic recovery path, which must retry.
        retryable = _make_agent_error(AgentErrorType.TOOL_FAILURE, retryable=True)
        engine._strategies.pop(AgentErrorType.TOOL_FAILURE)
        result = await engine.recover(retryable)
        assert result["action"] == "retry"

    async def test_recover_all_error_types_handled(self) -> None:
        """Every AgentErrorType must map to a strategy (no KeyError)."""
        from agentic_ai.orchestration import AgentErrorType, ErrorRecoveryEngine

        engine = ErrorRecoveryEngine()
        for error_type in AgentErrorType:
            err = _make_agent_error(error_type, context={"attempt": 0, "provider": "google"})
            result = await engine.recover(err)
            assert "action" in result, f"No action for {error_type}"

    def test_circuit_breaker_trips_after_threshold(self) -> None:
        from agentic_ai.orchestration import ErrorRecoveryEngine

        engine = ErrorRecoveryEngine()
        # Record threshold failures synchronously via internal helper
        for _ in range(3):
            engine._record_failure("flaky-agent")
        assert engine.is_circuit_open("flaky-agent") is True

    def test_circuit_breaker_not_tripped_below_threshold(self) -> None:
        from agentic_ai.orchestration import ErrorRecoveryEngine

        engine = ErrorRecoveryEngine()
        engine._record_failure("stable-agent")
        engine._record_failure("stable-agent")
        assert engine.is_circuit_open("stable-agent") is False

    def test_circuit_breaker_resets_after_cooldown(self) -> None:
        from agentic_ai.orchestration import ErrorRecoveryEngine, error_recovery as _er

        engine = ErrorRecoveryEngine()
        for _ in range(3):
            engine._record_failure("cooling-agent")

        assert engine.is_circuit_open("cooling-agent") is True

        # Force the tripped_at time into the past beyond the cooldown period
        with engine._lock:
            state = engine._breakers["cooling-agent"]
            state.tripped_at = time.monotonic() - (_er._CB_COOLDOWN_SECONDS + 1)

        assert engine.is_circuit_open("cooling-agent") is False

    def test_circuit_breaker_independent_per_agent(self) -> None:
        from agentic_ai.orchestration import ErrorRecoveryEngine

        engine = ErrorRecoveryEngine()
        for _ in range(3):
            engine._record_failure("bad-agent")

        assert engine.is_circuit_open("bad-agent") is True
        assert engine.is_circuit_open("good-agent") is False

    def test_failure_outside_window_not_counted(self) -> None:
        from agentic_ai.orchestration import ErrorRecoveryEngine, error_recovery as _er

        engine = ErrorRecoveryEngine()
        # Inject an old failure timestamp directly
        with engine._lock:
            state = engine._breakers["old-agent"]
            state.failure_timestamps.append(time.monotonic() - (_er._CB_WINDOW_SECONDS + 10))

        # Add only 2 fresh failures (below threshold of 3)
        engine._record_failure("old-agent")
        engine._record_failure("old-agent")
        assert engine.is_circuit_open("old-agent") is False


# ===========================================================================
# ContentSupervisor (classify + build_plan + process_article)
# ===========================================================================


def _make_supervisor(pipeline: Any, daily_budget_usd: float = 100.0) -> Any:
    from agentic_ai.orchestration import CostBudgetManager
    from agentic_ai.orchestration.supervisor import ContentSupervisor

    budget = CostBudgetManager(daily_budget_usd=daily_budget_usd)
    return ContentSupervisor(pipeline=pipeline, budget_manager=budget)


class TestContentSupervisorClassify:
    def test_short_content_fast_track(self) -> None:
        from agentic_ai.orchestration import ProcessingMode
        from agentic_ai.orchestration.supervisor import ContentSupervisor

        supervisor = ContentSupervisor.__new__(ContentSupervisor)
        article = _make_article(content="Short.")
        routing = supervisor.classify_article(article)
        assert routing.mode == ProcessingMode.FAST
        assert routing.primary_agent == "summarizer"
        assert routing.reason == "short_content_fast_track"

    def test_long_content_full_pipeline(self) -> None:
        from agentic_ai.orchestration import ProcessingMode
        from agentic_ai.orchestration.supervisor import ContentSupervisor

        supervisor = ContentSupervisor.__new__(ContentSupervisor)
        article = _make_article(content="x" * 6000)
        routing = supervisor.classify_article(article)
        assert routing.mode == ProcessingMode.FULL
        assert routing.primary_agent == "content-analyzer"
        assert routing.reason == "long_content_full_pipeline"

    def test_gov_source_full_with_supervisor(self) -> None:
        from agentic_ai.orchestration import ProcessingMode
        from agentic_ai.orchestration.supervisor import ContentSupervisor

        supervisor = ContentSupervisor.__new__(ContentSupervisor)
        article = _make_article(content="x" * 1000, source="data.gov.uk")
        routing = supervisor.classify_article(article)
        assert routing.mode == ProcessingMode.FULL
        assert "content-supervisor" in routing.supporting_agents
        assert routing.reason == "government_source_full_with_supervisor"

    def test_standard_content_default_routing(self) -> None:
        from agentic_ai.orchestration import ProcessingMode
        from agentic_ai.orchestration.supervisor import ContentSupervisor

        supervisor = ContentSupervisor.__new__(ContentSupervisor)
        article = _make_article(content="x" * 2000, source="example.com")
        routing = supervisor.classify_article(article)
        assert routing.mode == ProcessingMode.FULL
        assert routing.reason == "standard_full_pipeline"

    def test_article_id_fallback(self) -> None:
        from agentic_ai.orchestration.supervisor import ContentSupervisor

        supervisor = ContentSupervisor.__new__(ContentSupervisor)
        article: dict[str, Any] = {"content": "x" * 1000}
        routing = supervisor.classify_article(article)
        assert routing.article_id == "unknown"


class TestContentSupervisorBuildPlan:
    def test_fast_mode_plan_has_two_steps(self) -> None:
        from agentic_ai.orchestration import ArticleRouting, ProcessingMode
        from agentic_ai.orchestration.supervisor import ContentSupervisor

        supervisor = ContentSupervisor.__new__(ContentSupervisor)
        routing = ArticleRouting(
            article_id="art-1",
            primary_agent="summarizer",
            mode=ProcessingMode.FAST,
        )
        plan = supervisor.build_execution_plan(routing, mode="fast")
        assert len(plan.steps) == 2
        step_ids = {s.step_id for s in plan.steps}
        assert "step-summarizer" in step_ids
        assert "step-classifier" in step_ids

    def test_full_mode_plan_has_five_steps(self) -> None:
        from agentic_ai.orchestration import ArticleRouting, ProcessingMode
        from agentic_ai.orchestration.supervisor import ContentSupervisor

        supervisor = ContentSupervisor.__new__(ContentSupervisor)
        routing = ArticleRouting(
            article_id="art-2",
            primary_agent="content-analyzer",
            mode=ProcessingMode.FULL,
        )
        plan = supervisor.build_execution_plan(routing, mode="full")
        assert len(plan.steps) == 5

    def test_unknown_mode_falls_back_to_full(self) -> None:
        from agentic_ai.orchestration import ArticleRouting, ProcessingMode
        from agentic_ai.orchestration.supervisor import ContentSupervisor

        supervisor = ContentSupervisor.__new__(ContentSupervisor)
        routing = ArticleRouting(
            article_id="art-3",
            primary_agent="content-analyzer",
            mode=ProcessingMode.FULL,
        )
        plan = supervisor.build_execution_plan(routing, mode="banana")
        assert len(plan.steps) == 5

    def test_plan_has_unique_plan_id(self) -> None:
        from agentic_ai.orchestration import ArticleRouting, ProcessingMode
        from agentic_ai.orchestration.supervisor import ContentSupervisor

        supervisor = ContentSupervisor.__new__(ContentSupervisor)
        routing = ArticleRouting(article_id="art-4", primary_agent="x", mode=ProcessingMode.FULL)
        plan_a = supervisor.build_execution_plan(routing, mode="full")
        plan_b = supervisor.build_execution_plan(routing, mode="full")
        assert plan_a.plan_id != plan_b.plan_id


class TestContentSupervisorProcessArticle:
    async def test_process_article_happy_path(self, monkeypatch: pytest.MonkeyPatch) -> None:
        pipeline = _build_pipeline_stub(monkeypatch, quality_score=0.9)
        supervisor = _make_supervisor(pipeline)
        result = await supervisor.process_article(_make_article())
        assert result["quality_gate"]["passed"] is True
        assert "routing" in result
        assert "plan_id" in result
        assert "supervisor_timestamp" in result
        assert result["budget_check"]["affordable"] is True

    async def test_process_article_low_quality_gate(self, monkeypatch: pytest.MonkeyPatch) -> None:
        pipeline = _build_pipeline_stub(monkeypatch, quality_score=0.5)
        supervisor = _make_supervisor(pipeline)
        result = await supervisor.process_article(_make_article())
        assert result["quality_gate"]["passed"] is False
        assert result["quality_gate"]["score"] == pytest.approx(0.5, rel=1e-6)

    async def test_process_article_budget_exceeded_short_circuits(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        pipeline = _build_pipeline_stub(monkeypatch, quality_score=0.9)
        supervisor = _make_supervisor(pipeline, daily_budget_usd=0.000001)
        result = await supervisor.process_article(_make_article())
        assert result.get("error") == "budget_exceeded"
        assert "estimated_cost_usd" in result

    async def test_process_article_uses_article_id_key(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        pipeline = _build_pipeline_stub(monkeypatch, quality_score=0.9)
        supervisor = _make_supervisor(pipeline)
        article = {
            "article_id": "alt-id-999",
            "content": "body text",
        }
        result = await supervisor.process_article(article)
        # Should not error; article_id or id must have been resolved
        assert "routing" in result

    async def test_process_article_mode_preserved_in_result(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        pipeline = _build_pipeline_stub(monkeypatch, quality_score=0.9)
        supervisor = _make_supervisor(pipeline)
        result = await supervisor.process_article(_make_article(), mode="fast")
        assert result["mode"] == "fast"

    async def test_process_article_unknown_mode_falls_back_to_full(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        pipeline = _build_pipeline_stub(monkeypatch, quality_score=0.9)
        supervisor = _make_supervisor(pipeline)
        result = await supervisor.process_article(_make_article(), mode="nonexistent")
        assert result["mode"] == "full"


# ===========================================================================
# ArticleBatchProcessor
# ===========================================================================


class TestArticleBatchProcessor:
    async def test_process_batch_all_succeed(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from agentic_ai.orchestration import ArticleBatchProcessor

        pipeline = _build_pipeline_stub(monkeypatch, quality_score=0.9)
        supervisor = _make_supervisor(pipeline)
        processor = ArticleBatchProcessor(supervisor=supervisor, concurrency=2)

        articles = [
            _make_article(article_id=f"art-{i}", content=f"Content for article {i}")
            for i in range(4)
        ]
        result = await processor.process_batch(articles, mode="fast")

        assert result.total == 4
        assert result.succeeded == 4
        assert result.failed == 0
        assert result.skipped == 0
        assert result.duration_seconds >= 0.0
        assert result.completed_at is not None

    async def test_process_batch_skips_missing_content(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from agentic_ai.orchestration import ArticleBatchProcessor

        pipeline = _build_pipeline_stub(monkeypatch, quality_score=0.9)
        supervisor = _make_supervisor(pipeline)
        processor = ArticleBatchProcessor(supervisor=supervisor)

        articles: list[dict[str, Any]] = [
            {"id": "no-content", "content": ""},
            _make_article(article_id="with-content"),
        ]
        result = await processor.process_batch(articles)

        assert result.total == 2
        assert result.skipped == 1
        assert result.succeeded == 1

    async def test_process_batch_respects_priority_order(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from agentic_ai.orchestration import ArticleBatchProcessor

        pipeline = _build_pipeline_stub(monkeypatch, quality_score=0.9)
        supervisor = _make_supervisor(pipeline)
        processor = ArticleBatchProcessor(supervisor=supervisor, concurrency=1)

        processed_ids: list[str] = []
        original = supervisor.process_article

        async def tracking_process(article: dict[str, Any], mode: str = "full") -> dict[str, Any]:
            processed_ids.append(str(article.get("id", "")))
            outcome: dict[str, Any] = await original(article, mode=mode)
            return outcome

        supervisor.process_article = tracking_process

        articles = [
            _make_article(article_id="low", priority=1),
            _make_article(article_id="high", priority=10),
            _make_article(article_id="mid", priority=5),
        ]
        await processor.process_batch(articles)
        # Higher priority should be processed first
        assert processed_ids[0] == "high"

    async def test_process_batch_tolerates_non_numeric_priority(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from agentic_ai.orchestration import ArticleBatchProcessor

        pipeline = _build_pipeline_stub(monkeypatch, quality_score=0.9)
        supervisor = _make_supervisor(pipeline)
        processor = ArticleBatchProcessor(supervisor=supervisor, concurrency=1)

        # A non-numeric priority must not crash the priority sort.
        bad = {"id": "bad", "content": "Body text.", "priority": "not-a-number"}
        result = await processor.process_batch([bad])
        assert result.total == 1
        assert result.succeeded == 1

    async def test_process_batch_retries_on_failure(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from agentic_ai.orchestration import ArticleBatchProcessor

        pipeline = _build_pipeline_stub(monkeypatch, quality_score=0.9)
        supervisor = _make_supervisor(pipeline)
        processor = ArticleBatchProcessor(supervisor=supervisor, max_retries=1)

        call_count = 0
        original = supervisor.process_article

        async def sometimes_fail(article: dict[str, Any], mode: str = "full") -> dict[str, Any]:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise RuntimeError("transient")
            outcome: dict[str, Any] = await original(article, mode=mode)
            return outcome

        supervisor.process_article = sometimes_fail

        result = await processor.process_batch([_make_article()])
        assert result.succeeded == 1
        assert result.failed == 0
        assert call_count == 2  # 1 failure + 1 success

    async def test_process_batch_marks_failed_after_max_retries(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from agentic_ai.orchestration import ArticleBatchProcessor

        pipeline = _build_pipeline_stub(monkeypatch, quality_score=0.9)
        supervisor = _make_supervisor(pipeline)
        processor = ArticleBatchProcessor(supervisor=supervisor, max_retries=1)

        supervisor.process_article = AsyncMock(side_effect=RuntimeError("always fails"))

        result = await processor.process_batch([_make_article()])
        assert result.failed == 1
        assert result.succeeded == 0

    async def test_process_batch_empty_list(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from agentic_ai.orchestration import ArticleBatchProcessor

        pipeline = _build_pipeline_stub(monkeypatch, quality_score=0.9)
        supervisor = _make_supervisor(pipeline)
        processor = ArticleBatchProcessor(supervisor=supervisor)

        result = await processor.process_batch([])
        assert result.total == 0
        assert result.succeeded == 0

    async def test_retry_failed_reprocesses_only_failures(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from agentic_ai.orchestration import ArticleBatchProcessor

        pipeline = _build_pipeline_stub(monkeypatch, quality_score=0.9)
        supervisor = _make_supervisor(pipeline)
        processor = ArticleBatchProcessor(supervisor=supervisor, max_retries=0)

        # A prior batch with one failed article; retry_failed must reprocess
        # only the failure and succeed on the second attempt.
        from agentic_ai.orchestration.batch_processor import BatchResult

        fake_failed_result: dict[str, Any] = {
            "article_id": "retry-me",
            "status": "failed",
            "error": "boom",
            "retries": 0,
            "original_payload": _make_article(article_id="retry-me"),
        }
        fake_batch = BatchResult(
            batch_id="fake-batch",
            total=1,
            succeeded=0,
            failed=1,
            skipped=0,
            results=[fake_failed_result],
        )

        retry_result = await processor.retry_failed(fake_batch, mode="fast")
        # retry_failed delegates to process_batch which should succeed
        assert retry_result.total == 1

    async def test_retry_failed_no_failures_returns_empty_batch(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from agentic_ai.orchestration import ArticleBatchProcessor
        from agentic_ai.orchestration.batch_processor import BatchResult

        pipeline = _build_pipeline_stub(monkeypatch, quality_score=0.9)
        supervisor = _make_supervisor(pipeline)
        processor = ArticleBatchProcessor(supervisor=supervisor)

        empty_batch = BatchResult(
            batch_id="empty",
            total=0,
            succeeded=0,
            failed=0,
            skipped=0,
        )
        result = await processor.retry_failed(empty_batch)
        assert result.total == 0
        assert result.failed == 0

    async def test_process_batch_budget_exceeded_counts_as_failed(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """budget_exceeded results in result["error"] == "budget_exceeded", treated as failure."""
        from agentic_ai.orchestration import ArticleBatchProcessor

        pipeline = _build_pipeline_stub(monkeypatch, quality_score=0.9)
        # Deliberately tiny budget so process_article returns error dict
        supervisor = _make_supervisor(pipeline, daily_budget_usd=0.000001)
        processor = ArticleBatchProcessor(supervisor=supervisor, max_retries=0)

        result = await processor.process_batch([_make_article()])
        # process_article returns {"error": "budget_exceeded"} which causes RuntimeError
        assert result.failed == 1

    async def test_batch_result_has_per_article_results(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from agentic_ai.orchestration import ArticleBatchProcessor

        pipeline = _build_pipeline_stub(monkeypatch, quality_score=0.9)
        supervisor = _make_supervisor(pipeline)
        processor = ArticleBatchProcessor(supervisor=supervisor)

        articles = [_make_article(article_id=f"a{i}") for i in range(3)]
        result = await processor.process_batch(articles, mode="fast")
        assert len(result.results) == 3
        for r in result.results:
            assert "article_id" in r
            assert r["status"] in {"completed", "failed", "skipped"}

    async def test_concurrency_limiter_respected(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Verify at most `concurrency` articles process simultaneously."""
        from agentic_ai.orchestration import ArticleBatchProcessor

        pipeline = _build_pipeline_stub(monkeypatch, quality_score=0.9)
        supervisor = _make_supervisor(pipeline)
        concurrency = 2
        processor = ArticleBatchProcessor(supervisor=supervisor, concurrency=concurrency)

        active = {"count": 0, "max_seen": 0}

        async def slow_process(article: dict[str, Any], mode: str = "full") -> dict[str, Any]:
            active["count"] += 1
            active["max_seen"] = max(active["max_seen"], active["count"])
            await asyncio.sleep(0.01)
            active["count"] -= 1
            return {
                "article_id": article.get("id"),
                "summary": "Summary.",
                "topics": [],
                "sentiment": {},
                "quality_score": 0.9,
                "errors": [],
            }

        supervisor.process_article = slow_process

        articles = [_make_article(article_id=f"c{i}") for i in range(6)]
        await processor.process_batch(articles)
        assert active["max_seen"] <= concurrency


# ===========================================================================
# Types / enums sanity
# ===========================================================================


class TestTypes:
    def test_pricing_table_contains_expected_models(self) -> None:
        from agentic_ai.orchestration import PRICING

        assert "gemini-1.5-flash" in PRICING
        assert "claude-sonnet-4-6" in PRICING
        for model, rates in PRICING.items():
            assert "input" in rates, f"{model} missing input rate"
            assert "output" in rates, f"{model} missing output rate"

    def test_agent_error_type_values_are_strings(self) -> None:
        from agentic_ai.orchestration import AgentErrorType

        for member in AgentErrorType:
            assert isinstance(member.value, str)

    def test_processing_mode_full_is_default_fallback(self) -> None:
        from agentic_ai.orchestration import ProcessingMode
        from agentic_ai.orchestration.supervisor import ContentSupervisor

        assert ContentSupervisor._coerce_mode("full") == ProcessingMode.FULL
        assert ContentSupervisor._coerce_mode("FAST") == ProcessingMode.FAST
        assert ContentSupervisor._coerce_mode("garbage") == ProcessingMode.FULL

    def test_task_result_default_fields(self) -> None:
        from agentic_ai.orchestration import TaskResult

        result = TaskResult(task_id="t1", agent_id="a1", success=True)
        assert result.cost_usd == 0.0
        assert result.retries == 0
        assert result.error_type is None

    def test_handoff_payload_serialization(self) -> None:
        from agentic_ai.orchestration import HandoffPayload, HandoffReason

        payload = HandoffPayload(
            from_agent="a",
            to_agent="b",
            reason=HandoffReason.FALLBACK,
            instructions="Do this.",
        )
        assert payload.from_agent == "a"
        assert payload.to_agent == "b"
        assert payload.reason == HandoffReason.FALLBACK
        assert payload.partial_result is None
