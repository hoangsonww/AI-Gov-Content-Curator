"""
Complete type system for the SynthoraAI orchestration layer.

Defines enumerations, dataclasses, and pricing constants used across
all orchestration modules.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


class AgentErrorType(str, Enum):
    """Categorised error types that the orchestration layer can handle.

    Each member maps to a dedicated recovery strategy in
    :class:`~agentic_ai.orchestration.error_recovery.ErrorRecoveryEngine`.
    """

    RATE_LIMITED = "rate_limited"
    CONTEXT_OVERFLOW = "context_overflow"
    TOOL_FAILURE = "tool_failure"
    HALLUCINATION_DETECTED = "hallucination_detected"
    TIMEOUT = "timeout"
    MODEL_REFUSAL = "model_refusal"
    INVALID_OUTPUT = "invalid_output"
    SCHEMA_VALIDATION_FAILED = "schema_validation_failed"
    DEPENDENCY_FAILURE = "dependency_failure"
    BUDGET_EXCEEDED = "budget_exceeded"
    CIRCULAR_HANDOFF = "circular_handoff"
    MAX_ITERATIONS_EXCEEDED = "max_iterations_exceeded"
    EXTERNAL_API_FAILURE = "external_api_failure"
    PROVIDER_UNAVAILABLE = "provider_unavailable"
    CRAWLER_FAILURE = "crawler_failure"
    EMBEDDING_FAILURE = "embedding_failure"
    NEWSLETTER_SEND_FAILURE = "newsletter_send_failure"


class ModelProvider(str, Enum):
    """Supported LLM provider identifiers."""

    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    OPENAI = "openai"
    COHERE = "cohere"


class ProcessingMode(str, Enum):
    """Article processing modes controlling which pipeline stages run."""

    FULL = "full"
    """All five agents execute sequentially."""

    FAST = "fast"
    """Only summarisation and classification run (no quality loop)."""

    ENRICH = "enrich"
    """Adds sentiment and quality scoring on top of an existing summary."""

    REPROCESS = "reprocess"
    """Full run that forces a cache bypass and writes new outputs."""


class CostTier(str, Enum):
    """Relative cost classification for agent definitions."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class HandoffReason(str, Enum):
    """Why control was transferred from one agent to another."""

    SPECIALIZATION = "specialization"
    """The receiving agent has domain expertise for this task."""

    ESCALATION = "escalation"
    """The sending agent could not meet quality requirements."""

    FALLBACK = "fallback"
    """The primary agent failed and a secondary agent is taking over."""

    PROVIDER_FAILOVER = "provider_failover"
    """The upstream LLM provider is unavailable; switching providers."""


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass
class AgentDefinition:
    """Metadata describing a registered agent.

    Args:
        agent_id: Unique slug, e.g. ``"content-analyzer"``.
        display_name: Human-readable label.
        provider: LLM provider this agent is pinned to.
        model: Model identifier within the provider's API.
        capabilities: Set of task strings the agent can handle.
        cost_tier: Relative cost classification.
        max_retries: Maximum retry attempts before handing off.
        timeout_seconds: Per-call wall-clock timeout.
        metadata: Arbitrary extension data.
    """

    agent_id: str
    display_name: str
    provider: ModelProvider
    model: str
    capabilities: list[str] = field(default_factory=list)
    cost_tier: CostTier = CostTier.MEDIUM
    max_retries: int = 3
    timeout_seconds: int = 60
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class IntentParameters:
    """Extracted intent from an incoming article or task request.

    Args:
        primary_intent: The dominant processing goal.
        secondary_intents: Additional goals to satisfy in parallel or sequence.
        required_capabilities: Capability strings that must be matched.
        preferred_provider: Optional provider preference from the caller.
        context: Free-form context dictionary forwarded from the caller.
    """

    primary_intent: str
    secondary_intents: list[str] = field(default_factory=list)
    required_capabilities: list[str] = field(default_factory=list)
    preferred_provider: Optional[ModelProvider] = None
    context: dict[str, Any] = field(default_factory=dict)


@dataclass
class RetryPolicy:
    """Retry behaviour configuration for an orchestration step.

    Args:
        max_attempts: Total call attempts (1 = no retry).
        base_delay_seconds: Initial backoff delay.
        max_delay_seconds: Cap for exponential backoff.
        jitter: Whether to apply full-jitter (AWS pattern).
        retryable_errors: Error types that should trigger a retry.
    """

    max_attempts: int = 3
    base_delay_seconds: float = 1.0
    max_delay_seconds: float = 60.0
    jitter: bool = True
    retryable_errors: list[AgentErrorType] = field(default_factory=list)


@dataclass
class TaskResult:
    """Outcome of a single orchestration task step.

    Args:
        task_id: Unique identifier for this task invocation.
        agent_id: Agent that produced the result.
        success: Whether the task completed without error.
        output: Structured output payload.
        error_type: Categorised error type if ``success`` is ``False``.
        error_message: Human-readable error description.
        duration_ms: Wall-clock execution time.
        tokens_used: Token counts keyed by ``"input"``, ``"output"``, ``"cached"``.
        cost_usd: Estimated cost in US dollars.
        retries: Number of retries consumed.
    """

    task_id: str
    agent_id: str
    success: bool
    output: dict[str, Any] = field(default_factory=dict)
    error_type: Optional[AgentErrorType] = None
    error_message: Optional[str] = None
    duration_ms: float = 0.0
    tokens_used: dict[str, int] = field(default_factory=dict)
    cost_usd: float = 0.0
    retries: int = 0


@dataclass
class TaskMetadata:
    """Contextual metadata attached to every orchestration task.

    Args:
        task_id: Unique task identifier.
        article_id: Originating article identifier.
        mode: Processing mode in effect.
        created_at: ISO-8601 creation timestamp.
        tags: Arbitrary key-value tags for filtering and observability.
    """

    task_id: str
    article_id: str
    mode: ProcessingMode
    created_at: str
    tags: dict[str, str] = field(default_factory=dict)


@dataclass
class HandoffPayload:
    """Data package exchanged when one agent hands off to another.

    Args:
        from_agent: Originating agent identifier.
        to_agent: Receiving agent identifier.
        reason: Why the handoff is occurring.
        context: State context carried forward.
        partial_result: Any intermediate output produced so far.
        instructions: Supplementary instructions for the receiving agent.
    """

    from_agent: str
    to_agent: str
    reason: HandoffReason
    context: dict[str, Any] = field(default_factory=dict)
    partial_result: Optional[dict[str, Any]] = None
    instructions: str = ""


@dataclass
class AgentError:
    """Structured error record emitted by agents and recovery machinery.

    Args:
        error_type: Categorised error type.
        agent_id: Agent that raised the error.
        message: Human-readable description.
        retryable: Whether the error warrants a retry.
        context: Diagnostic context data.
        original_exception: Stringified original exception if available.
    """

    error_type: AgentErrorType
    agent_id: str
    message: str
    retryable: bool = True
    context: dict[str, Any] = field(default_factory=dict)
    original_exception: Optional[str] = None


@dataclass
class ArticleRouting:
    """Routing decision produced by the supervisor for an article.

    Args:
        article_id: Article being routed.
        primary_agent: Agent that owns the primary processing step.
        supporting_agents: Agents that run in support / parallel.
        mode: Effective processing mode.
        estimated_cost_usd: Rough cost estimate for the full plan.
        reason: Human-readable routing rationale.
    """

    article_id: str
    primary_agent: str
    supporting_agents: list[str] = field(default_factory=list)
    mode: ProcessingMode = ProcessingMode.FULL
    estimated_cost_usd: float = 0.0
    reason: str = ""


@dataclass
class ExecutionStep:
    """A single step within an execution plan.

    Args:
        step_id: Unique step identifier.
        agent_id: Agent responsible for this step.
        depends_on: Step IDs that must complete before this step runs.
        can_run_parallel: Whether this step can run concurrently with peers.
        retry_policy: Override retry policy for this step.
        metadata: Arbitrary per-step metadata.
    """

    step_id: str
    agent_id: str
    depends_on: list[str] = field(default_factory=list)
    can_run_parallel: bool = False
    retry_policy: Optional[RetryPolicy] = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ExecutionPlan:
    """Ordered execution plan produced for a routing decision.

    Args:
        plan_id: Unique plan identifier.
        article_id: Article being processed.
        mode: Processing mode.
        steps: Ordered list of execution steps.
        estimated_cost_usd: Aggregated cost estimate across all steps.
        parallel_groups: Groups of step IDs that can execute concurrently.
    """

    plan_id: str
    article_id: str
    mode: ProcessingMode
    steps: list[ExecutionStep] = field(default_factory=list)
    estimated_cost_usd: float = 0.0
    parallel_groups: list[list[str]] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Pricing table (USD per 1 000 000 tokens)
# ---------------------------------------------------------------------------

#: Token pricing dictionary.
#:
#: Keys are model identifiers. Each value is a dict with up to three keys:
#: ``"input"``, ``"output"``, and optionally ``"cached"`` (prompt-cache read).
#: All values are in USD per 1 000 000 tokens.
PRICING: dict[str, dict[str, float]] = {
    "claude-opus-4-6": {
        "input": 15.00,
        "output": 75.00,
        "cached": 1.50,
    },
    "claude-sonnet-4-6": {
        "input": 3.00,
        "output": 15.00,
        "cached": 0.30,
    },
    "claude-haiku-4-5": {
        "input": 0.80,
        "output": 4.00,
        "cached": 0.08,
    },
    "gemini-2.0-flash": {
        "input": 0.10,
        "output": 0.40,
        "cached": 0.025,
    },
    "gemini-2.0-flash-lite": {
        "input": 0.075,
        "output": 0.30,
        "cached": 0.01875,
    },
    "gemini-1.5-flash": {
        "input": 0.075,
        "output": 0.30,
        "cached": 0.01875,
    },
    "gemini-1.5-pro": {
        "input": 1.25,
        "output": 5.00,
        "cached": 0.3125,
    },
    "gpt-4o": {
        "input": 2.50,
        "output": 10.00,
        "cached": 1.25,
    },
    "gpt-4o-mini": {
        "input": 0.15,
        "output": 0.60,
        "cached": 0.075,
    },
}
