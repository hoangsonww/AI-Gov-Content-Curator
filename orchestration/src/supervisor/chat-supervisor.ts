/**
 * Chat supervisor that routes user queries to specialised agents,
 * manages handoffs, enforces budget limits, and synthesises responses.
 *
 * Ties together the AgentRegistry, DualProviderClient, ContextManager,
 * and CostTracker into a single entry-point for the backend chat API.
 */

import { AgentRegistry, INTENT_CAPABILITY_MAP } from "../agents/agent-registry";
import {
  type AgentDefinition,
  ChatIntentType,
  type IntentParameters,
  type Message,
  type StreamChunk,
  type TaskMetadata,
} from "../agents/types";
import { ContextManager, type SessionState } from "../context/context-manager";
import { CostTracker } from "../cost/cost-tracker";
import {
  DualProviderClient,
  type GenerateResult,
  type LLMClientConfig,
} from "../llm/dual-provider-client";
import {
  GROUNDING_RULES,
  GroundingValidator,
} from "../agents/prompts/grounding";
import { PromptCacheStrategy } from "../agents/prompts/cache-strategy";
import { createLogger } from "../observability/logger";

const logger = createLogger("supervisor.chat");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ChatSupervisorConfig {
  /** LLM client configuration. */
  llm?: LLMClientConfig;
  /** Daily budget cap in USD. */
  dailyBudgetUsd?: number;
  /** Maximum handoff chain depth before terminating. */
  maxHandoffDepth?: number;
  /** Maximum active messages per session. */
  maxActiveMessages?: number;
}

/** Full response from the supervisor for a single user query. */
export interface SupervisorResponse {
  /** Final answer text. */
  content: string;
  /** Session identifier. */
  sessionId: string;
  /** Classified intent. */
  intent: IntentParameters;
  /** Agent that produced the primary response. */
  agentId: string;
  /** Execution metadata from the generating call. */
  metadata: TaskMetadata;
  /** Grounding validation result. */
  grounding: { valid: boolean; warnings: string[]; score: number };
  /** Handoff chain that was followed (empty if direct). */
  handoffChain: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_HANDOFF_DEPTH = 5;

// Intent classification prompt used by the supervisor agent
const INTENT_CLASSIFICATION_PROMPT = `Classify the user's intent into exactly one of:
article_search, article_qa, topic_exploration, trend_analysis,
bias_analysis, clarification, general_chat, quality_review.

Also extract: entities (topics, names), date ranges, source filters.
Respond in JSON:
{
  "intent": "<type>",
  "entities": ["..."],
  "dateRange": {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"} | null,
  "source": "<source>" | null,
  "confidence": 0.0-1.0
}`;

// ---------------------------------------------------------------------------
// Supervisor
// ---------------------------------------------------------------------------

export class ChatSupervisor {
  private readonly registry: AgentRegistry;
  private readonly client: DualProviderClient;
  private readonly context: ContextManager;
  private readonly costTracker: CostTracker;
  private readonly grounding: GroundingValidator;
  private readonly cacheStrategy: PromptCacheStrategy;
  private readonly maxDepth: number;

  constructor(config: ChatSupervisorConfig = {}) {
    this.registry = AgentRegistry.createWithDefaults();
    this.client = new DualProviderClient(config.llm);
    this.context = new ContextManager({
      maxActiveMessages: config.maxActiveMessages ?? 20,
    });
    this.costTracker = new CostTracker({
      dailyBudgetUsd: config.dailyBudgetUsd ?? 10,
    });
    this.grounding = new GroundingValidator();
    this.cacheStrategy = new PromptCacheStrategy();
    this.maxDepth = config.maxHandoffDepth ?? MAX_HANDOFF_DEPTH;
  }

  // -----------------------------------------------------------------------
  // Primary entry point — non-streaming
  // -----------------------------------------------------------------------

  async chat(
    sessionId: string,
    userMessage: string,
  ): Promise<SupervisorResponse> {
    const start = Date.now();
    logger.info("chat.start", { sessionId, queryLength: userMessage.length });

    // 1. Record user message
    this.context.addMessage(sessionId, {
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString(),
    });

    // 2. Classify intent
    const intent = await this.classifyIntent(sessionId, userMessage);
    logger.debug("chat.intent_classified", {
      sessionId,
      intent: intent.intent,
      confidence: intent.confidence,
    });

    // 3. Route to best agent
    const agent = this.routeToAgent(intent);
    logger.debug("chat.routed", {
      sessionId,
      agentId: agent.id,
      model: agent.model,
    });

    // 4. Budget check
    const estimatedCost = this.costTracker.estimateCost(
      agent.model,
      2000,
      1000,
    );
    if (!this.costTracker.canAfford(estimatedCost)) {
      logger.warn("chat.budget_exceeded", { sessionId, estimatedCost });
      return this.budgetExceededResponse(sessionId, intent, agent);
    }

    try {
      // 5. Generate response (with potential handoff chain)
      const { result, handoffChain } = await this.executeWithHandoffs(
        sessionId,
        agent,
        intent,
        [],
      );

      // 6. Handle empty content (model returned no text)
      const content =
        result.content ||
        "I was unable to generate a response. Please try rephrasing your question.";

      // 7. Validate grounding
      const groundingResult = this.grounding.validate(content, []);

      // 8. Record assistant message and cost
      this.context.addMessage(sessionId, {
        role: "assistant",
        content,
        agentId: result.metadata.agentId,
        timestamp: new Date().toISOString(),
      });
      this.costTracker.recordUsage(result.metadata);

      const latency = Date.now() - start;
      logger.info("chat.complete", {
        sessionId,
        agentId: result.metadata.agentId,
        latencyMs: latency,
        groundingScore: groundingResult.score,
        handoffDepth: handoffChain.length,
      });

      return {
        content,
        sessionId,
        intent,
        agentId: result.metadata.agentId,
        metadata: result.metadata,
        grounding: groundingResult,
        handoffChain,
      };
    } catch (err) {
      const latency = Date.now() - start;
      logger.error("chat.failed", {
        sessionId,
        agentId: agent.id,
        latencyMs: latency,
        error: err instanceof Error ? err.message : String(err),
      });

      // Return a structured error response instead of throwing
      return {
        content:
          "I encountered an error processing your request. Please try again.",
        sessionId,
        intent,
        agentId: agent.id,
        metadata: {
          agentId: agent.id,
          model: agent.model,
          provider: agent.provider,
          timestamp: new Date().toISOString(),
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: latency,
          retryCount: 0,
          estimatedCost: 0,
        },
        grounding: { valid: true, warnings: [], score: 0 },
        handoffChain: [],
      };
    }
  }

  // -----------------------------------------------------------------------
  // Streaming entry point
  // -----------------------------------------------------------------------

  async *chatStream(
    sessionId: string,
    userMessage: string,
  ): AsyncGenerator<StreamChunk> {
    logger.info("chatStream.start", { sessionId });

    this.context.addMessage(sessionId, {
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString(),
    });

    const intent = await this.classifyIntent(sessionId, userMessage);
    const agent = this.routeToAgent(intent);

    // Budget check for streaming too
    const estimatedCost = this.costTracker.estimateCost(
      agent.model,
      2000,
      1000,
    );
    if (!this.costTracker.canAfford(estimatedCost)) {
      yield {
        delta: `I'm sorry, but the daily usage budget has been reached. Please try again tomorrow.`,
        done: true,
        agentId: agent.id,
      };
      return;
    }

    const { summary, messages } = this.context.getContext(sessionId);
    const systemPrompt = this.buildSystemPrompt(agent, summary);

    let fullText = "";
    for await (const chunk of this.client.stream({
      agent,
      systemPrompt,
      messages,
    })) {
      fullText += chunk.delta;
      yield chunk;

      // On final chunk, record the assistant message and cost
      if (chunk.done && chunk.usage) {
        this.context.addMessage(sessionId, {
          role: "assistant",
          content: fullText,
          agentId: agent.id,
          timestamp: new Date().toISOString(),
        });
        this.costTracker.recordUsage({
          agentId: agent.id,
          model: agent.model,
          provider: agent.provider,
          timestamp: new Date().toISOString(),
          inputTokens: chunk.usage.inputTokens,
          outputTokens: chunk.usage.outputTokens,
          latencyMs: 0,
          retryCount: 0,
          estimatedCost: this.costTracker.estimateCost(
            agent.model,
            chunk.usage.inputTokens,
            chunk.usage.outputTokens,
            chunk.usage.cachedTokens ?? 0,
          ),
        });
        logger.info("chatStream.complete", { sessionId, agentId: agent.id });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Intent classification
  // -----------------------------------------------------------------------

  private async classifyIntent(
    sessionId: string,
    query: string,
  ): Promise<IntentParameters> {
    const supervisor = this.registry.get("supervisor");
    if (!supervisor) {
      return this.fallbackIntent(query);
    }

    try {
      const result = await this.client.generate({
        agent: supervisor,
        systemPrompt: INTENT_CLASSIFICATION_PROMPT,
        messages: [{ role: "user", content: query }],
        maxTokens: 256,
        temperature: 0.1,
      });

      // Strip markdown fences if the LLM wraps JSON in ```json ... ```
      const raw = result.content
        .replace(/^```(?:json)?\s*|\s*```$/g, "")
        .trim();
      const parsed = JSON.parse(raw);

      // Validate the intent is a known ChatIntentType value
      const validIntents = Object.values(ChatIntentType) as string[];
      const intent = validIntents.includes(parsed.intent)
        ? (parsed.intent as ChatIntentType)
        : ChatIntentType.general_chat;

      return {
        query,
        intent,
        entities: Array.isArray(parsed.entities) ? parsed.entities : [],
        dateRange: parsed.dateRange ?? undefined,
        source: parsed.source ?? undefined,
        confidence:
          typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      };
    } catch (err) {
      logger.warn("Intent classification failed, using fallback", {
        error: err instanceof Error ? err.message : String(err),
        query: query.slice(0, 100),
      });
      return this.fallbackIntent(query);
    }
  }

  private fallbackIntent(query: string): IntentParameters {
    // Simple keyword heuristic when LLM classification is unavailable
    const lower = query.toLowerCase();
    let intent = ChatIntentType.general_chat;

    if (lower.includes("search") || lower.includes("find")) {
      intent = ChatIntentType.article_search;
    } else if (lower.includes("trend") || lower.includes("over time")) {
      intent = ChatIntentType.trend_analysis;
    } else if (lower.includes("bias") || lower.includes("framing")) {
      intent = ChatIntentType.bias_analysis;
    } else if (
      lower.includes("what") ||
      lower.includes("how") ||
      lower.includes("why")
    ) {
      intent = ChatIntentType.article_qa;
    } else if (lower.includes("topic") || lower.includes("explore")) {
      intent = ChatIntentType.topic_exploration;
    }

    return {
      query,
      intent,
      entities: [],
      confidence: 0.3,
    };
  }

  // -----------------------------------------------------------------------
  // Routing
  // -----------------------------------------------------------------------

  private routeToAgent(intent: IntentParameters): AgentDefinition {
    const capability = INTENT_CAPABILITY_MAP[intent.intent];
    const candidates = this.registry.listByCapability(capability);

    if (candidates.length > 0) {
      // Prefer the non-fallback (primary) agent
      return (
        candidates.find((a) => !a.id.endsWith("-google")) ?? candidates[0]!
      );
    }

    // Default to supervisor
    return this.registry.get("supervisor")!;
  }

  // -----------------------------------------------------------------------
  // Execution with handoff chain
  // -----------------------------------------------------------------------

  private async executeWithHandoffs(
    sessionId: string,
    agent: AgentDefinition,
    intent: IntentParameters,
    visited: string[],
  ): Promise<{ result: GenerateResult; handoffChain: string[] }> {
    const chain = [...visited, agent.id];

    if (chain.length > this.maxDepth) {
      // Circular or too-deep chain — use supervisor to synthesise
      const supervisor = this.registry.get("supervisor") ?? agent;
      const result = await this.generateForAgent(sessionId, supervisor);
      return { result, handoffChain: chain };
    }

    try {
      const result = await this.generateForAgent(sessionId, agent);
      return { result, handoffChain: chain };
    } catch (err) {
      // Attempt fallback via registry
      const fallback = this.registry.getFallback(agent.id);
      if (fallback && !chain.includes(fallback.id)) {
        return this.executeWithHandoffs(sessionId, fallback, intent, chain);
      }
      throw err;
    }
  }

  private async generateForAgent(
    sessionId: string,
    agent: AgentDefinition,
  ): Promise<GenerateResult> {
    const { summary, messages } = this.context.getContext(sessionId);
    const systemPrompt = this.buildSystemPrompt(agent, summary);

    return this.client.generate({
      agent,
      systemPrompt,
      messages,
    });
  }

  // -----------------------------------------------------------------------
  // Prompt construction
  // -----------------------------------------------------------------------

  private buildSystemPrompt(
    agent: AgentDefinition,
    conversationSummary: string,
  ): string {
    const parts: string[] = [
      "## Grounding Rules",
      GROUNDING_RULES.map((r, i) => `${i + 1}. ${r}`).join("\n"),
      "",
      `## Agent: ${agent.name}`,
      agent.systemPrompt,
    ];

    if (conversationSummary) {
      parts.push("", "## Prior Context", conversationSummary);
    }

    return parts.join("\n");
  }

  // -----------------------------------------------------------------------
  // Budget exceeded helper
  // -----------------------------------------------------------------------

  private budgetExceededResponse(
    sessionId: string,
    intent: IntentParameters,
    agent: AgentDefinition,
  ): SupervisorResponse {
    const snapshot = this.costTracker.getSnapshot();
    return {
      content: `I'm sorry, but the daily usage budget ($${snapshot.budgetUsd}) has been reached. Please try again tomorrow or contact an administrator.`,
      sessionId,
      intent,
      agentId: agent.id,
      metadata: {
        agentId: agent.id,
        model: agent.model,
        provider: agent.provider,
        timestamp: new Date().toISOString(),
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
        retryCount: 0,
        estimatedCost: 0,
      },
      grounding: { valid: true, warnings: [], score: 1 },
      handoffChain: [],
    };
  }

  // -----------------------------------------------------------------------
  // Accessors for the backend API
  // -----------------------------------------------------------------------

  /** Expose cost tracker for dashboard/monitoring endpoints. */
  getCostSnapshot() {
    return this.costTracker.getSnapshot();
  }

  /** Expose session state for debugging/admin. */
  getSessionState(sessionId: string): SessionState | undefined {
    return this.context.getOrCreateSession(sessionId);
  }

  /** Expose available providers. */
  getAvailableProviders() {
    return this.client.getAvailableProviders();
  }

  /** Expose the agent registry for introspection. */
  getRegistry(): AgentRegistry {
    return this.registry;
  }

  /** Health check for monitoring endpoints. */
  healthCheck(): {
    status: "healthy" | "degraded" | "unhealthy";
    providers: string[];
    warnings: string[];
    budget: { totalUsd: number; remainingUsd: number; budgetUsd: number };
  } {
    const providers = this.client.getAvailableProviders();
    const snapshot = this.costTracker.getSnapshot();
    const warnings: string[] = [];

    if (providers.length === 0) {
      warnings.push("No LLM providers available");
    } else if (providers.length === 1) {
      warnings.push(`Only ${providers[0]} available — failover disabled`);
    }

    if (snapshot.remainingUsd <= 0) {
      warnings.push("Daily budget exhausted");
    } else if (snapshot.remainingUsd < snapshot.budgetUsd * 0.1) {
      warnings.push(
        `Budget nearly exhausted: $${snapshot.remainingUsd.toFixed(4)} remaining`,
      );
    }

    const status =
      providers.length === 0 || snapshot.remainingUsd <= 0
        ? "unhealthy"
        : providers.length === 1 ||
            snapshot.remainingUsd < snapshot.budgetUsd * 0.1
          ? "degraded"
          : "healthy";

    return {
      status,
      providers: providers.map(String),
      warnings,
      budget: {
        totalUsd: snapshot.totalUsd,
        remainingUsd: snapshot.remainingUsd,
        budgetUsd: snapshot.budgetUsd,
      },
    };
  }

  /** Delete a session and free its memory. */
  deleteSession(sessionId: string): boolean {
    return this.context.deleteSession(sessionId);
  }
}
