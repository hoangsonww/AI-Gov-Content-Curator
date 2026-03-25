"""
Error recovery engine for the SynthoraAI orchestration layer.

Implements per-error-type async recovery strategies, an exponential
backoff helper using the AWS full-jitter pattern, and a thread-safe
circuit breaker that trips after repeated failures within a rolling
time window.
"""
from __future__ import annotations

import asyncio
import random
import threading
import time
from collections import defaultdict, deque
from typing import Any, Callable, Coroutine, Optional

import structlog

from .types import AgentError, AgentErrorType, ModelProvider

logger = structlog.get_logger(__name__)

# Circuit breaker parameters
_CB_FAILURE_THRESHOLD: int = 3       # failures within the window to trip
_CB_WINDOW_SECONDS: float = 300.0    # rolling window (5 minutes)
_CB_COOLDOWN_SECONDS: float = 60.0   # time the circuit stays open


class _CircuitBreakerState:
    """Per-agent circuit-breaker bookkeeping."""

    def __init__(self) -> None:
        self.failure_timestamps: deque[float] = deque()
        self.tripped_at: Optional[float] = None


class ErrorRecoveryEngine:
    """Async error recovery with circuit breaking and provider failover.

    Recovery strategies are selected by :class:`~agentic_ai.orchestration.types.AgentErrorType`.
    Each strategy is an async coroutine that receives the original
    :class:`~agentic_ai.orchestration.types.AgentError` and returns a
    ``dict[str, Any]`` containing recovery instructions for the supervisor.

    Circuit breaker state is maintained per ``agent_id``.  After
    :data:`_CB_FAILURE_THRESHOLD` failures within a
    :data:`_CB_WINDOW_SECONDS` rolling window, the breaker trips and
    subsequent calls to :meth:`is_circuit_open` return ``True`` for
    :data:`_CB_COOLDOWN_SECONDS`.

    Example::

        engine = ErrorRecoveryEngine()
        result = await engine.recover(agent_error)
    """

    def __init__(self) -> None:
        self._lock: threading.Lock = threading.Lock()
        self._breakers: dict[str, _CircuitBreakerState] = defaultdict(_CircuitBreakerState)

        # Map each error type to a recovery coroutine factory
        self._strategies: dict[
            AgentErrorType,
            Callable[[AgentError], Coroutine[Any, Any, dict[str, Any]]],
        ] = {
            AgentErrorType.RATE_LIMITED: self._recover_rate_limited,
            AgentErrorType.CONTEXT_OVERFLOW: self._recover_context_overflow,
            AgentErrorType.TOOL_FAILURE: self._recover_tool_failure,
            AgentErrorType.HALLUCINATION_DETECTED: self._recover_hallucination,
            AgentErrorType.TIMEOUT: self._recover_timeout,
            AgentErrorType.MODEL_REFUSAL: self._recover_model_refusal,
            AgentErrorType.INVALID_OUTPUT: self._recover_invalid_output,
            AgentErrorType.SCHEMA_VALIDATION_FAILED: self._recover_schema_validation,
            AgentErrorType.DEPENDENCY_FAILURE: self._recover_dependency_failure,
            AgentErrorType.BUDGET_EXCEEDED: self._recover_budget_exceeded,
            AgentErrorType.CIRCULAR_HANDOFF: self._recover_circular_handoff,
            AgentErrorType.MAX_ITERATIONS_EXCEEDED: self._recover_max_iterations,
            AgentErrorType.EXTERNAL_API_FAILURE: self._recover_external_api_failure,
            AgentErrorType.PROVIDER_UNAVAILABLE: self._recover_provider_unavailable,
            AgentErrorType.CRAWLER_FAILURE: self._recover_crawler_failure,
            AgentErrorType.EMBEDDING_FAILURE: self._recover_embedding_failure,
            AgentErrorType.NEWSLETTER_SEND_FAILURE: self._recover_newsletter_failure,
        }

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def recover(self, error: AgentError) -> dict[str, Any]:
        """Select and execute the recovery strategy for ``error``.

        Also records the failure in the circuit breaker for ``error.agent_id``.

        Args:
            error: The structured :class:`~agentic_ai.orchestration.types.AgentError`.

        Returns:
            A recovery instruction dictionary consumed by the supervisor.
        """
        self._record_failure(error.agent_id)

        strategy = self._strategies.get(error.error_type, self._recover_generic)
        logger.info(
            "error_recovery.strategy_selected",
            error_type=error.error_type,
            agent_id=error.agent_id,
            retryable=error.retryable,
        )
        return await strategy(error)

    def is_circuit_open(self, agent_id: str) -> bool:
        """Check whether the circuit breaker for ``agent_id`` is tripped.

        Args:
            agent_id: Agent slug to query.

        Returns:
            ``True`` if the circuit is open (agent should not be called).
        """
        with self._lock:
            state = self._breakers[agent_id]
            now = time.monotonic()

            if state.tripped_at is not None:
                if now - state.tripped_at < _CB_COOLDOWN_SECONDS:
                    return True
                # Cooldown elapsed — reset
                state.tripped_at = None
                state.failure_timestamps.clear()
                logger.info("error_recovery.circuit_reset", agent_id=agent_id)

            return False

    # ------------------------------------------------------------------
    # Circuit breaker internals
    # ------------------------------------------------------------------

    def _record_failure(self, agent_id: str) -> None:
        """Record a failure timestamp and trip the breaker if the threshold is exceeded.

        Args:
            agent_id: Agent that failed.
        """
        with self._lock:
            state = self._breakers[agent_id]
            now = time.monotonic()

            # Evict timestamps outside the rolling window
            while state.failure_timestamps and (
                now - state.failure_timestamps[0] > _CB_WINDOW_SECONDS
            ):
                state.failure_timestamps.popleft()

            state.failure_timestamps.append(now)

            if len(state.failure_timestamps) >= _CB_FAILURE_THRESHOLD and state.tripped_at is None:
                state.tripped_at = now
                logger.warning(
                    "error_recovery.circuit_tripped",
                    agent_id=agent_id,
                    failure_count=len(state.failure_timestamps),
                    cooldown_seconds=_CB_COOLDOWN_SECONDS,
                )

    # ------------------------------------------------------------------
    # Backoff helper
    # ------------------------------------------------------------------

    @staticmethod
    async def _backoff_with_jitter(
        attempt: int,
        base: float = 1.0,
        cap: float = 60.0,
    ) -> None:
        """Sleep for an AWS full-jitter backoff duration.

        Formula: ``sleep = random(0, min(cap, base * 2 ** attempt))``

        Args:
            attempt: Zero-based attempt index.
            base: Base delay in seconds.
            cap: Maximum delay cap in seconds.
        """
        ceiling = min(cap, base * (2 ** attempt))
        delay = random.uniform(0, ceiling)
        logger.debug("error_recovery.backoff", attempt=attempt, delay_seconds=delay)
        await asyncio.sleep(delay)

    # ------------------------------------------------------------------
    # Recovery strategies (one per AgentErrorType)
    # ------------------------------------------------------------------

    async def _recover_rate_limited(self, error: AgentError) -> dict[str, Any]:
        """Wait with exponential backoff then retry."""
        attempt = error.context.get("attempt", 0)
        await self._backoff_with_jitter(attempt, base=2.0, cap=120.0)
        return {"action": "retry", "agent_id": error.agent_id, "reason": "rate_limit_backoff_complete"}

    async def _recover_context_overflow(self, error: AgentError) -> dict[str, Any]:
        """Truncate content and retry with a smaller context window."""
        return {
            "action": "retry",
            "agent_id": error.agent_id,
            "modifications": {"truncate_content": True, "max_chars": 8000},
            "reason": "context_truncated_for_retry",
        }

    async def _recover_tool_failure(self, error: AgentError) -> dict[str, Any]:
        """Retry with a minimal tool set or skip the failing tool."""
        return {
            "action": "retry",
            "agent_id": error.agent_id,
            "modifications": {"disable_tool": error.context.get("tool_name")},
            "reason": "tool_failure_retry_without_tool",
        }

    async def _recover_hallucination(self, error: AgentError) -> dict[str, Any]:
        """Escalate to the content supervisor for review."""
        return {
            "action": "escalate",
            "agent_id": "content-supervisor",
            "reason": "hallucination_detected_escalating_to_supervisor",
            "context": error.context,
        }

    async def _recover_timeout(self, error: AgentError) -> dict[str, Any]:
        """Retry on a lighter / faster model after a brief wait."""
        await self._backoff_with_jitter(0, base=1.0, cap=10.0)
        return {
            "action": "retry",
            "agent_id": error.agent_id,
            "modifications": {"model_override": "gemini-2.0-flash-lite"},
            "reason": "timeout_retrying_on_faster_model",
        }

    async def _recover_model_refusal(self, error: AgentError) -> dict[str, Any]:
        """Rewrite the prompt and retry, or skip if rewriting is not feasible."""
        return {
            "action": "retry",
            "agent_id": error.agent_id,
            "modifications": {"rewrite_prompt": True},
            "reason": "model_refusal_prompt_rewrite",
        }

    async def _recover_invalid_output(self, error: AgentError) -> dict[str, Any]:
        """Retry with stricter output format instructions."""
        return {
            "action": "retry",
            "agent_id": error.agent_id,
            "modifications": {"enforce_json": True},
            "reason": "invalid_output_retrying_with_strict_format",
        }

    async def _recover_schema_validation(self, error: AgentError) -> dict[str, Any]:
        """Retry with explicit schema instructions injected into the prompt."""
        return {
            "action": "retry",
            "agent_id": error.agent_id,
            "modifications": {"inject_schema_hint": True},
            "reason": "schema_validation_failed_injecting_schema",
        }

    async def _recover_dependency_failure(self, error: AgentError) -> dict[str, Any]:
        """Mark the failing dependency and attempt partial execution."""
        return {
            "action": "partial",
            "agent_id": error.agent_id,
            "skip_dependency": error.context.get("dependency"),
            "reason": "dependency_unavailable_executing_partial",
        }

    async def _recover_budget_exceeded(self, error: AgentError) -> dict[str, Any]:
        """Abort the current task and surface a budget-exceeded signal."""
        logger.warning(
            "error_recovery.budget_exceeded",
            agent_id=error.agent_id,
            context=error.context,
        )
        return {
            "action": "abort",
            "agent_id": error.agent_id,
            "reason": "daily_budget_exceeded",
        }

    async def _recover_circular_handoff(self, error: AgentError) -> dict[str, Any]:
        """Break the cycle by routing directly to the output node."""
        return {
            "action": "terminate",
            "agent_id": error.agent_id,
            "reason": "circular_handoff_detected_terminating_cycle",
        }

    async def _recover_max_iterations(self, error: AgentError) -> dict[str, Any]:
        """Accept the best result so far and proceed to output."""
        return {
            "action": "accept_partial",
            "agent_id": error.agent_id,
            "reason": "max_iterations_exceeded_accepting_best_result",
        }

    async def _recover_external_api_failure(self, error: AgentError) -> dict[str, Any]:
        """Retry after a brief jitter wait."""
        await self._backoff_with_jitter(error.context.get("attempt", 0), base=2.0, cap=30.0)
        return {
            "action": "retry",
            "agent_id": error.agent_id,
            "reason": "external_api_retry_after_backoff",
        }

    async def _recover_provider_unavailable(self, error: AgentError) -> dict[str, Any]:
        """Failover to the alternate provider (Google ↔ Anthropic)."""
        current_provider = error.context.get("provider", ModelProvider.GOOGLE)
        failover_provider = (
            ModelProvider.ANTHROPIC
            if current_provider == ModelProvider.GOOGLE
            else ModelProvider.GOOGLE
        )
        logger.info(
            "error_recovery.provider_failover",
            from_provider=current_provider,
            to_provider=failover_provider,
        )
        return {
            "action": "failover",
            "provider": failover_provider,
            "agent_id": error.agent_id,
            "reason": f"provider_{current_provider}_unavailable_switching_to_{failover_provider}",
        }

    async def _recover_crawler_failure(self, error: AgentError) -> dict[str, Any]:
        """Skip the failing URL and continue with the remaining batch."""
        return {
            "action": "skip",
            "agent_id": error.agent_id,
            "skip_url": error.context.get("url"),
            "reason": "crawler_failure_skipping_url",
        }

    async def _recover_embedding_failure(self, error: AgentError) -> dict[str, Any]:
        """Retry the embedding request once; degrade to keyword search on second failure."""
        attempt = error.context.get("attempt", 0)
        if attempt == 0:
            await self._backoff_with_jitter(0, base=1.0, cap=10.0)
            return {
                "action": "retry",
                "agent_id": error.agent_id,
                "reason": "embedding_failure_retry",
            }
        return {
            "action": "degrade",
            "agent_id": error.agent_id,
            "fallback": "keyword_search",
            "reason": "embedding_failure_degrading_to_keyword_search",
        }

    async def _recover_newsletter_failure(self, error: AgentError) -> dict[str, Any]:
        """Queue the newsletter send for later retry and notify the operator."""
        return {
            "action": "queue_retry",
            "agent_id": error.agent_id,
            "retry_after_seconds": 300,
            "reason": "newsletter_send_failure_queued_for_retry",
        }

    async def _recover_generic(self, error: AgentError) -> dict[str, Any]:
        """Catch-all fallback strategy: retry once or abort."""
        if error.retryable:
            await self._backoff_with_jitter(0)
            return {"action": "retry", "agent_id": error.agent_id, "reason": "generic_retry"}
        return {"action": "abort", "agent_id": error.agent_id, "reason": "non_retryable_error"}
