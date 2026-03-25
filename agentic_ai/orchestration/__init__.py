"""
SynthoraAI orchestration layer.

Provides content supervision, agent registration, cost budgeting,
error recovery with circuit breaking, dead-letter queuing, and
concurrent batch processing on top of the LangGraph pipeline.
"""

from .agent_registry import AgentRegistry
from .batch_processor import ArticleBatchProcessor, BatchResult
from .cost_budget import CostBudgetManager
from .dead_letter import DeadLetterQueue
from .error_recovery import ErrorRecoveryEngine
from .supervisor import ContentSupervisor
from .types import (
    AgentDefinition,
    AgentError,
    AgentErrorType,
    ArticleRouting,
    CostTier,
    ExecutionPlan,
    ExecutionStep,
    HandoffPayload,
    HandoffReason,
    IntentParameters,
    ModelProvider,
    PRICING,
    ProcessingMode,
    RetryPolicy,
    TaskMetadata,
    TaskResult,
)

__all__ = [
    # Core orchestrator
    "ContentSupervisor",
    # Registry
    "AgentRegistry",
    # Cost
    "CostBudgetManager",
    # Error recovery
    "ErrorRecoveryEngine",
    # Dead-letter queue
    "DeadLetterQueue",
    # Batch processing
    "ArticleBatchProcessor",
    "BatchResult",
    # Types & enums
    "AgentDefinition",
    "AgentError",
    "AgentErrorType",
    "ArticleRouting",
    "CostTier",
    "ExecutionPlan",
    "ExecutionStep",
    "HandoffPayload",
    "HandoffReason",
    "IntentParameters",
    "ModelProvider",
    "PRICING",
    "ProcessingMode",
    "RetryPolicy",
    "TaskMetadata",
    "TaskResult",
]
