"""
Thread-safe agent registry for the SynthoraAI orchestration layer.

Agents are registered with metadata describing their capabilities,
provider, model, and cost tier. The registry supports capability-based
lookup and provider-aware fallback selection.
"""
from __future__ import annotations

import threading
from typing import Optional

import structlog

from .types import AgentDefinition, CostTier, ModelProvider

logger = structlog.get_logger(__name__)


class AgentRegistry:
    """Thread-safe registry of :class:`~agentic_ai.orchestration.types.AgentDefinition` objects.

    All public methods acquire ``self._lock`` for the duration of the
    operation so that concurrent reads and writes from the batch processor
    and supervisor are safe.

    Example::

        registry = AgentRegistry()
        registry.register_defaults()
        agent = registry.get("content-analyzer")
    """

    def __init__(self) -> None:
        self._agents: dict[str, AgentDefinition] = {}
        self._lock: threading.Lock = threading.Lock()

    # ------------------------------------------------------------------
    # Mutation helpers
    # ------------------------------------------------------------------

    def register(self, definition: AgentDefinition) -> None:
        """Register or overwrite an agent definition.

        Args:
            definition: The :class:`AgentDefinition` to store.
        """
        with self._lock:
            self._agents[definition.agent_id] = definition
            logger.debug(
                "agent_registry.registered",
                agent_id=definition.agent_id,
                provider=definition.provider,
                model=definition.model,
            )

    def remove(self, agent_id: str) -> bool:
        """Remove an agent from the registry.

        Args:
            agent_id: The agent slug to remove.

        Returns:
            ``True`` if the agent existed and was removed, ``False`` otherwise.
        """
        with self._lock:
            existed = agent_id in self._agents
            if existed:
                del self._agents[agent_id]
                logger.debug("agent_registry.removed", agent_id=agent_id)
            return existed

    # ------------------------------------------------------------------
    # Read helpers
    # ------------------------------------------------------------------

    def get(self, agent_id: str) -> Optional[AgentDefinition]:
        """Retrieve an agent definition by its identifier.

        Args:
            agent_id: Unique agent slug.

        Returns:
            The :class:`AgentDefinition` or ``None`` if not found.
        """
        with self._lock:
            return self._agents.get(agent_id)

    def list_all(self) -> list[AgentDefinition]:
        """Return a snapshot list of all registered agents.

        Returns:
            List of :class:`AgentDefinition` instances (copy of registry values).
        """
        with self._lock:
            return list(self._agents.values())

    def list_by_capability(self, capability: str) -> list[AgentDefinition]:
        """Return agents that advertise a specific capability.

        Args:
            capability: Capability string to search for (case-sensitive).

        Returns:
            List of matching :class:`AgentDefinition` instances.
        """
        with self._lock:
            return [
                agent
                for agent in self._agents.values()
                if capability in agent.capabilities
            ]

    def list_by_provider(self, provider: ModelProvider) -> list[AgentDefinition]:
        """Return agents pinned to a specific provider.

        Args:
            provider: :class:`~agentic_ai.orchestration.types.ModelProvider` enum value.

        Returns:
            List of matching :class:`AgentDefinition` instances.
        """
        with self._lock:
            return [
                agent
                for agent in self._agents.values()
                if agent.provider == provider
            ]

    def get_fallback(
        self,
        failed_agent_id: str,
        required_capability: Optional[str] = None,
    ) -> Optional[AgentDefinition]:
        """Select a fallback agent when the primary agent fails.

        The fallback candidate must:
        - Not be the failed agent itself.
        - Optionally possess ``required_capability`` when specified.
        - Be ranked by cost tier (LOW preferred over MEDIUM over HIGH).

        Args:
            failed_agent_id: Agent slug that should be excluded.
            required_capability: Optional capability that the fallback must support.

        Returns:
            Best available :class:`AgentDefinition` fallback or ``None``.
        """
        tier_order = {CostTier.LOW: 0, CostTier.MEDIUM: 1, CostTier.HIGH: 2}

        with self._lock:
            candidates = [
                agent
                for agent in self._agents.values()
                if agent.agent_id != failed_agent_id
                and (
                    required_capability is None
                    or required_capability in agent.capabilities
                )
            ]

        if not candidates:
            return None

        candidates.sort(key=lambda a: tier_order.get(a.cost_tier, 99))
        chosen = candidates[0]
        logger.info(
            "agent_registry.fallback_selected",
            failed=failed_agent_id,
            chosen=chosen.agent_id,
        )
        return chosen

    # ------------------------------------------------------------------
    # Factory
    # ------------------------------------------------------------------

    @classmethod
    def register_defaults(cls) -> AgentRegistry:
        """Create a registry pre-populated with the seven default SynthoraAI agents.

        The default agents and their provider assignments are:

        - ``content-analyzer``  — Google, MEDIUM
        - ``summarizer``        — Google, MEDIUM
        - ``classifier``        — Google, LOW
        - ``sentiment-analyzer``— Google, LOW
        - ``quality-checker``   — Google, LOW
        - ``content-supervisor``— Anthropic, HIGH
        - ``batch-processor``   — Google, LOW

        Returns:
            A fully populated :class:`AgentRegistry` instance.
        """
        registry = cls()

        defaults: list[AgentDefinition] = [
            AgentDefinition(
                agent_id="content-analyzer",
                display_name="Content Analyzer",
                provider=ModelProvider.GOOGLE,
                model="gemini-1.5-flash",
                capabilities=["content_analysis", "entity_extraction", "structure_parsing"],
                cost_tier=CostTier.MEDIUM,
                max_retries=3,
                timeout_seconds=60,
            ),
            AgentDefinition(
                agent_id="summarizer",
                display_name="Summarizer",
                provider=ModelProvider.GOOGLE,
                model="gemini-1.5-flash",
                capabilities=["summarization", "abstractive_summary", "extractive_summary"],
                cost_tier=CostTier.MEDIUM,
                max_retries=3,
                timeout_seconds=60,
            ),
            AgentDefinition(
                agent_id="classifier",
                display_name="Classifier",
                provider=ModelProvider.GOOGLE,
                model="gemini-1.5-flash",
                capabilities=["classification", "topic_detection", "taxonomy_mapping"],
                cost_tier=CostTier.LOW,
                max_retries=3,
                timeout_seconds=30,
            ),
            AgentDefinition(
                agent_id="sentiment-analyzer",
                display_name="Sentiment Analyzer",
                provider=ModelProvider.GOOGLE,
                model="gemini-1.5-flash",
                capabilities=["sentiment_analysis", "bias_detection", "tone_scoring"],
                cost_tier=CostTier.LOW,
                max_retries=3,
                timeout_seconds=30,
            ),
            AgentDefinition(
                agent_id="quality-checker",
                display_name="Quality Checker",
                provider=ModelProvider.GOOGLE,
                model="gemini-1.5-flash",
                capabilities=["quality_scoring", "coherence_check", "hallucination_detection"],
                cost_tier=CostTier.LOW,
                max_retries=2,
                timeout_seconds=30,
            ),
            AgentDefinition(
                agent_id="content-supervisor",
                display_name="Content Supervisor",
                provider=ModelProvider.ANTHROPIC,
                model="claude-sonnet-4-6",
                capabilities=[
                    "supervision",
                    "escalation_handling",
                    "quality_review",
                    "hallucination_detection",
                ],
                cost_tier=CostTier.HIGH,
                max_retries=2,
                timeout_seconds=120,
            ),
            AgentDefinition(
                agent_id="batch-processor",
                display_name="Batch Processor",
                provider=ModelProvider.GOOGLE,
                model="gemini-2.0-flash-lite",
                capabilities=["batch_processing", "bulk_classification", "bulk_summarization"],
                cost_tier=CostTier.LOW,
                max_retries=3,
                timeout_seconds=300,
            ),
        ]

        for definition in defaults:
            registry.register(definition)

        logger.info("agent_registry.defaults_registered", count=len(defaults))
        return registry
