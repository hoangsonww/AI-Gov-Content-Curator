/**
 * @synthoraai/orchestration — Agent orchestration layer for SynthoraAI.
 *
 * Provides dual-provider LLM client (Anthropic + Google), chat supervisor
 * with intent-based routing, context management, cost tracking, agent
 * registry, prompt caching, and grounding validation.
 */

// -- Supervisor (primary entry point) -------------------------------------
export {
  ChatSupervisor,
  type ChatSupervisorConfig,
  type SupervisorResponse,
} from "./supervisor";

// -- LLM client -----------------------------------------------------------
export {
  DualProviderClient,
  type LLMClientConfig,
  type GenerateParams,
  type GenerateResult,
} from "./llm";

// -- Context management ---------------------------------------------------
export {
  ContextManager,
  type ContextManagerConfig,
  type SessionState,
} from "./context";

// -- Cost tracking --------------------------------------------------------
export {
  CostTracker,
  type CostTrackerConfig,
  type DailyUsageSnapshot,
} from "./cost";

// -- Agent registry -------------------------------------------------------
export { AgentRegistry, INTENT_CAPABILITY_MAP } from "./agents/agent-registry";

// -- Prompts --------------------------------------------------------------
export {
  PromptRegistry,
  type PromptRecord,
  type PromptMetrics,
  SUPERVISOR_SYSTEM_PROMPT,
  ARTICLE_SEARCH_SYSTEM_PROMPT,
  ARTICLE_QA_SYSTEM_PROMPT,
  TOPIC_EXPLORER_SYSTEM_PROMPT,
  TREND_ANALYST_SYSTEM_PROMPT,
  BIAS_ANALYZER_SYSTEM_PROMPT,
  CLARIFICATION_SYSTEM_PROMPT,
  QUALITY_REVIEWER_SYSTEM_PROMPT,
  GROUNDING_RULES,
  GroundingValidator,
  type GroundingSource,
  type GroundingValidationResult,
  PromptCacheStrategy,
  type CacheLayer,
  type CachedPrompt,
  type CacheSavingsEstimate,
} from "./agents/prompts";

// -- Config ---------------------------------------------------------------
export {
  loadOrchestrationEnv,
  tryLoadOrchestrationEnv,
  preflightCheck,
  type OrchestrationEnv,
} from "./config";

// -- Observability --------------------------------------------------------
export {
  Logger,
  createLogger,
  MetricsCollector,
  orchestrationMetrics,
  type LogLevel,
  type LogEntry,
  type MetricPoint,
  type HistogramSummary,
} from "./observability";

// -- Schemas (API boundary validation) ------------------------------------
export {
  chatRequestSchema,
  articleProcessRequestSchema,
  batchProcessRequestSchema,
  chatResponseSchema,
  healthCheckSchema,
  type ChatRequest,
  type ArticleProcessRequest,
  type BatchProcessRequest,
  type ChatResponse,
  type HealthCheckResponse,
} from "./schemas";

// -- Pipeline bridge (Python API client) -----------------------------------
export {
  PipelineClient,
  type PipelineClientConfig,
  type ArticlePayload as PipelineArticlePayload,
  type ProcessRequest as PipelineProcessRequest,
  type AnalyzeRequest as PipelineAnalyzeRequest,
  type BatchRequest as PipelineBatchRequest,
  type ProcessResult as PipelineProcessResult,
  type AnalyzeResult as PipelineAnalyzeResult,
  type BatchResult as PipelineBatchResult,
  type PipelineHealth,
} from "./bridge";

// -- Error templates ------------------------------------------------------
export {
  getErrorResponse,
  formatApiError,
  type ErrorResponse,
} from "./templates";

// -- Types & enums --------------------------------------------------------
export {
  AgentErrorType,
  ModelProvider,
  ProcessingMode,
  CostTier,
  HandoffReason,
  ChatIntentType,
  MODEL_PRICING,
  type AgentDefinition,
  type IntentParameters,
  type RetryPolicy,
  type TaskMetadata,
  type TaskResult,
  type HandoffPayload,
  type AgentError,
  type Message,
  type StreamChunk,
} from "./agents/types";
