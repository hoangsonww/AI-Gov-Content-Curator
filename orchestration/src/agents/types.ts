/**
 * Core type system for the SynthoraAI TypeScript orchestration layer.
 *
 * Note: The TypeScript layer uses its own enum value sets optimised for
 * chat routing (e.g. ProcessingMode, CostTier). These intentionally differ
 * from the Python pipeline enums in agentic_ai/orchestration/types.py which
 * are tuned for article batch processing. Cross-layer communication goes
 * through the backend API, which maps between the two schemas.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Error categories that can arise during agent execution. */
export enum AgentErrorType {
  rate_limited = "rate_limited",
  context_overflow = "context_overflow",
  tool_failure = "tool_failure",
  invalid_response = "invalid_response",
  timeout = "timeout",
  budget_exceeded = "budget_exceeded",
  provider_unavailable = "provider_unavailable",
  circular_handoff = "circular_handoff",
  max_iterations = "max_iterations",
  schema_validation = "schema_validation",
  authentication = "authentication",
  network_error = "network_error",
  content_filtered = "content_filtered",
  model_overloaded = "model_overloaded",
  token_limit = "token_limit",
  serialization = "serialization",
  unknown = "unknown",
}

/** Supported LLM providers. */
export enum ModelProvider {
  anthropic = "anthropic",
  google = "google",
  openai = "openai",
}

/** Processing mode determines how the orchestrator routes a query. */
export enum ProcessingMode {
  DIRECT = "DIRECT",
  TOOL_AUGMENTED = "TOOL_AUGMENTED",
  AGENTIC = "AGENTIC",
}

/** Cost tier for budget-aware provider/model selection. */
export enum CostTier {
  economy = "economy",
  standard = "standard",
  premium = "premium",
}

/** Reason a task is transferred to another agent. */
export enum HandoffReason {
  specialization = "specialization",
  context_limit = "context_limit",
  tool_requirement = "tool_requirement",
  quality_threshold = "quality_threshold",
  user_request = "user_request",
  fallback = "fallback",
}

/** Detected intent type of a chat message. */
export enum ChatIntentType {
  article_search = "article_search",
  article_qa = "article_qa",
  topic_exploration = "topic_exploration",
  trend_analysis = "trend_analysis",
  bias_analysis = "bias_analysis",
  clarification = "clarification",
  general_chat = "general_chat",
  quality_review = "quality_review",
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** Defines an agent's identity, capabilities, and configuration. */
export interface AgentDefinition {
  /** Unique identifier for the agent. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Short description of purpose. */
  description: string;
  /** LLM provider this agent runs on. */
  provider: ModelProvider;
  /** Model identifier string (e.g. "claude-sonnet-4-6"). */
  model: string;
  /** Capability tags used for capability-based routing. */
  capabilities: string[];
  /** System prompt template for this agent. */
  systemPrompt: string;
  /** Optional tool names this agent has access to. */
  tools?: string[];
  /** ID of the agent to fall back to on failure. */
  fallbackAgentId?: string;
  /** Max tokens to generate. */
  maxTokens?: number;
  /** Temperature for sampling. */
  temperature?: number;
}

/** Extracted intent parameters from a chat query. */
export interface IntentParameters {
  /** Raw query text. */
  query: string;
  /** Classified intent type. */
  intent: ChatIntentType;
  /** Extracted entities (topics, names, etc.). */
  entities: string[];
  /** Date range filter if detected. */
  dateRange?: { start: string; end: string };
  /** Source filter if detected. */
  source?: string;
  /** Confidence score 0–1. */
  confidence: number;
}

/** Retry configuration for resilient execution. */
export interface RetryPolicy {
  /** Maximum number of attempts. */
  maxAttempts: number;
  /** Base delay in milliseconds before first retry. */
  baseDelayMs: number;
  /** Maximum delay cap in milliseconds. */
  maxDelayMs: number;
  /** Multiplier for exponential backoff. */
  backoffMultiplier: number;
  /** Whether to add random jitter to the delay. */
  jitter: boolean;
}

/** Metadata captured alongside a task result. */
export interface TaskMetadata {
  /** Agent that produced this result. */
  agentId: string;
  /** Model used for generation. */
  model: string;
  /** Provider used. */
  provider: ModelProvider;
  /** ISO timestamp of execution. */
  timestamp: string;
  /** Prompt tokens consumed. */
  inputTokens: number;
  /** Completion tokens generated. */
  outputTokens: number;
  /** Cached tokens (if prompt caching was active). */
  cachedTokens?: number;
  /** Wall-clock latency in milliseconds. */
  latencyMs: number;
  /** Number of retry attempts made. */
  retryCount: number;
  /** Estimated cost in USD. */
  estimatedCost: number;
}

/** Outcome of a single agent task execution. */
export interface TaskResult {
  /** Unique result identifier. */
  id: string;
  /** Whether the task succeeded. */
  success: boolean;
  /** Generated content on success. */
  content?: string;
  /** Structured data payload on success. */
  data?: unknown;
  /** Error information on failure. */
  error?: AgentError;
  /** Execution metadata. */
  metadata: TaskMetadata;
}

/** Payload carried when control is transferred between agents. */
export interface HandoffPayload {
  /** Agent transferring control. */
  fromAgentId: string;
  /** Agent receiving control. */
  toAgentId: string;
  /** Reason for the handoff. */
  reason: HandoffReason;
  /** Context to carry forward. */
  context: Record<string, unknown>;
  /** Conversation history to preserve. */
  messages: Message[];
  /** Chain depth to detect circular handoffs. */
  chainDepth: number;
  /** History of agents visited in this chain. */
  visitedAgents: string[];
}

/** Structured error with optional cause. */
export interface AgentError {
  /** Error category. */
  type: AgentErrorType;
  /** Human-readable message. */
  message: string;
  /** Whether a retry may succeed. */
  recoverable: boolean;
  /** Suggested retry delay in milliseconds. */
  retryAfterMs?: number;
  /** Original exception if available. */
  originalException?: unknown;
}

/** A single message in a conversation thread. */
export interface Message {
  /** Conversation role. */
  role: "user" | "assistant" | "system" | "tool";
  /** Message text content. */
  content: string;
  /** Optional tool call id for tool role messages. */
  toolCallId?: string;
  /** ISO timestamp. */
  timestamp?: string;
  /** Agent that produced this message. */
  agentId?: string;
}

/** A chunk emitted during streaming generation. */
export interface StreamChunk {
  /** Incremental text delta. */
  delta: string;
  /** Whether this is the final chunk. */
  done: boolean;
  /** Full accumulated text (present on the final chunk). */
  fullText?: string;
  /** Agent that produced this chunk. */
  agentId?: string;
  /** Usage information on the final chunk. */
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
  };
}

// ---------------------------------------------------------------------------
// Pricing constant
// ---------------------------------------------------------------------------

/**
 * Model pricing in USD per 1 million tokens.
 * Keys follow the model identifier strings used by providers.
 * Format: { input, output, cachedInput }
 */
export const MODEL_PRICING: Record<
  string,
  { input: number; output: number; cachedInput?: number }
> = {
  // Anthropic — cached = 10% of input (per Anthropic published pricing)
  "claude-opus-4-6": { input: 15, output: 75, cachedInput: 1.5 },
  "claude-sonnet-4-6": { input: 3, output: 15, cachedInput: 0.3 },
  "claude-haiku-4-5": { input: 0.8, output: 4, cachedInput: 0.08 },
  // Google Gemini
  "gemini-2.0-flash": { input: 0.1, output: 0.4, cachedInput: 0.025 },
  "gemini-2.0-flash-lite": { input: 0.075, output: 0.3, cachedInput: 0.01875 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3, cachedInput: 0.01875 },
  "gemini-1.5-pro": { input: 1.25, output: 5, cachedInput: 0.3125 },
  // OpenAI
  "gpt-4o": { input: 2.5, output: 10, cachedInput: 1.25 },
  "gpt-4o-mini": { input: 0.15, output: 0.6, cachedInput: 0.075 },
};
