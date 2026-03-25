/**
 * Dual-provider LLM client wrapping Anthropic and Google Generative AI.
 *
 * Provides a unified interface for text generation and streaming across
 * both providers, with automatic failover when the primary is unavailable.
 */

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI, type GenerateContentResult } from '@google/generative-ai';

import { createLogger } from '../observability/logger';
import {
  type AgentDefinition,
  type AgentError,
  AgentErrorType,
  type Message,
  ModelProvider,
  MODEL_PRICING,
  type RetryPolicy,
  type StreamChunk,
  type TaskMetadata,
} from '../agents/types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface LLMClientConfig {
  /** Anthropic API key. Falls back to ANTHROPIC_API_KEY env var. */
  anthropicApiKey?: string;
  /** Google AI API key. Falls back to GOOGLE_API_KEY env var. */
  googleApiKey?: string;
  /** Default retry policy applied to all calls unless overridden. */
  defaultRetryPolicy?: RetryPolicy;
  /** Request timeout in milliseconds (default 60 000). */
  timeoutMs?: number;
}

/** Parameters for a single LLM generation call. */
export interface GenerateParams {
  /** Agent definition driving model/provider selection. */
  agent: AgentDefinition;
  /** System-level instructions (used as Anthropic system or Google system_instruction). */
  systemPrompt?: string;
  /** Conversation messages. */
  messages: Message[];
  /** Override max tokens for this call. */
  maxTokens?: number;
  /** Override temperature for this call. */
  temperature?: number;
  /** Override retry policy for this call. */
  retryPolicy?: RetryPolicy;
}

/** Result from a non-streaming generation call. */
export interface GenerateResult {
  /** Generated text content. */
  content: string;
  /** Execution metadata. */
  metadata: TaskMetadata;
  /** Provider-specific stop reason. */
  stopReason?: string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  backoffMultiplier: 2,
  jitter: true,
};

const DEFAULT_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const llmLogger = createLogger('llm.dual-provider');

export class DualProviderClient {
  private readonly anthropic: Anthropic | null;
  private readonly google: GoogleGenerativeAI | null;
  private readonly defaultRetry: RetryPolicy;
  private readonly timeoutMs: number;

  constructor(config: LLMClientConfig = {}) {
    const anthropicKey = config.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY;
    const googleKey = config.googleApiKey ?? process.env.GOOGLE_API_KEY;

    this.anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;
    this.google = googleKey ? new GoogleGenerativeAI(googleKey) : null;
    this.defaultRetry = config.defaultRetryPolicy ?? DEFAULT_RETRY_POLICY;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Generate a complete response (non-streaming). */
  async generate(params: GenerateParams): Promise<GenerateResult> {
    const retry = params.retryPolicy ?? this.defaultRetry;
    const provider = params.agent.provider;

    llmLogger.debug('generate.start', { agentId: params.agent.id, provider, model: params.agent.model });

    return this.withRetry(retry, async (attempt) => {
      const start = Date.now();
      try {
        const result =
          provider === ModelProvider.anthropic
            ? await this.generateAnthropic(params)
            : await this.generateGoogle(params);

        llmLogger.info('generate.success', {
          agentId: params.agent.id,
          model: params.agent.model,
          latencyMs: Date.now() - start,
          attempt,
        });

        return {
          ...result,
          metadata: {
            ...result.metadata,
            retryCount: attempt,
          },
        };
      } catch (err) {
        llmLogger.warn('generate.attempt_failed', {
          agentId: params.agent.id,
          provider,
          attempt,
          error: err instanceof Error ? err.message : String(err),
        });

        // On final attempt, try failover provider
        if (attempt >= retry.maxAttempts - 1) {
          const fallbackProvider =
            provider === ModelProvider.anthropic
              ? ModelProvider.google
              : ModelProvider.anthropic;

          // Only failover if the other provider is available
          if (
            (fallbackProvider === ModelProvider.anthropic && !this.anthropic) ||
            (fallbackProvider === ModelProvider.google && !this.google)
          ) {
            throw err;
          }

          llmLogger.info('generate.failover', {
            from: provider,
            to: fallbackProvider,
            agentId: params.agent.id,
          });

          const fallbackAgent: AgentDefinition = {
            ...params.agent,
            provider: fallbackProvider,
            model: this.defaultModelForProvider(fallbackProvider),
          };
          return this.generateSingleAttempt(
            { ...params, agent: fallbackAgent },
            start,
            attempt
          );
        }
        throw err;
      }
    });
  }

  /** Generate a streaming response, yielding incremental chunks. */
  async *stream(params: GenerateParams): AsyncGenerator<StreamChunk> {
    const provider = params.agent.provider;
    if (provider === ModelProvider.anthropic) {
      yield* this.streamAnthropic(params);
    } else {
      yield* this.streamGoogle(params);
    }
  }

  /** Check which providers are configured and available. */
  getAvailableProviders(): ModelProvider[] {
    const available: ModelProvider[] = [];
    if (this.anthropic) available.push(ModelProvider.anthropic);
    if (this.google) available.push(ModelProvider.google);
    return available;
  }

  // -----------------------------------------------------------------------
  // Anthropic
  // -----------------------------------------------------------------------

  private async generateAnthropic(params: GenerateParams): Promise<GenerateResult> {
    const start = Date.now();
    return this.generateSingleAttempt(params, start, 0);
  }

  private async generateSingleAttempt(
    params: GenerateParams,
    start: number,
    attempt: number
  ): Promise<GenerateResult> {
    const { agent, systemPrompt, messages, maxTokens, temperature } = params;

    if (agent.provider === ModelProvider.anthropic) {
      if (!this.anthropic) throw this.providerError('anthropic', agent.id);

      const response = await this.withTimeout(
        this.anthropic.messages.create({
          model: agent.model,
          max_tokens: maxTokens ?? agent.maxTokens ?? 4096,
          temperature: temperature ?? agent.temperature ?? 0.3,
          system: systemPrompt ?? agent.systemPrompt,
          messages: messages
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        }),
        `Anthropic ${agent.model}`,
      );

      const textBlock = response.content.find((b) => b.type === 'text');
      const content = textBlock?.type === 'text' ? textBlock.text : '';
      const latencyMs = Date.now() - start;

      return {
        content,
        stopReason: response.stop_reason ?? undefined,
        metadata: this.buildMetadata(agent, {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          cachedTokens: (response.usage as unknown as Record<string, number>).cache_read_input_tokens ?? 0,
          latencyMs,
          retryCount: attempt,
        }),
      };
    }

    // Google path
    return this.generateGoogleDirect(params, start, attempt);
  }

  private async *streamAnthropic(params: GenerateParams): AsyncGenerator<StreamChunk> {
    if (!this.anthropic) throw this.providerError('anthropic', params.agent.id);

    const { agent, systemPrompt, messages, maxTokens, temperature } = params;

    const stream = this.anthropic.messages.stream({
      model: agent.model,
      max_tokens: maxTokens ?? agent.maxTokens ?? 4096,
      temperature: temperature ?? agent.temperature ?? 0.3,
      system: systemPrompt ?? agent.systemPrompt,
      messages: messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    });

    let accumulated = '';
    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        accumulated += event.delta.text;
        yield {
          delta: event.delta.text,
          done: false,
          agentId: agent.id,
        };
      }
    }

    const finalMessage = await stream.finalMessage();
    yield {
      delta: '',
      done: true,
      fullText: accumulated,
      agentId: agent.id,
      usage: {
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
        cachedTokens: (finalMessage.usage as unknown as Record<string, number>).cache_read_input_tokens,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Google
  // -----------------------------------------------------------------------

  private async generateGoogle(params: GenerateParams): Promise<GenerateResult> {
    const start = Date.now();
    return this.generateGoogleDirect(params, start, 0);
  }

  private async generateGoogleDirect(
    params: GenerateParams,
    start: number,
    attempt: number
  ): Promise<GenerateResult> {
    if (!this.google) throw this.providerError('google', params.agent.id);

    const { agent, systemPrompt, messages, maxTokens, temperature } = params;
    const model = this.google.getGenerativeModel({
      model: agent.model,
      systemInstruction: systemPrompt ?? agent.systemPrompt,
      generationConfig: {
        maxOutputTokens: maxTokens ?? agent.maxTokens ?? 4096,
        temperature: temperature ?? agent.temperature ?? 0.3,
      },
    });

    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    // Last message must be user — pop it for sendMessage
    const lastUserMsg = history.pop();
    if (!lastUserMsg || lastUserMsg.role !== 'user') {
      throw new Error('Conversation must end with a user message for Google provider');
    }

    const chat = model.startChat({ history });
    const result: GenerateContentResult = await this.withTimeout(
      chat.sendMessage(lastUserMsg.parts[0]!.text),
      `Google ${agent.model}`,
    );

    const content = result.response.text();
    const usage = result.response.usageMetadata;
    const latencyMs = Date.now() - start;

    return {
      content,
      metadata: this.buildMetadata(agent, {
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
        cachedTokens: usage?.cachedContentTokenCount ?? 0,
        latencyMs,
        retryCount: attempt,
      }),
    };
  }

  private async *streamGoogle(params: GenerateParams): AsyncGenerator<StreamChunk> {
    if (!this.google) throw this.providerError('google', params.agent.id);

    const { agent, systemPrompt, messages, maxTokens, temperature } = params;
    const model = this.google.getGenerativeModel({
      model: agent.model,
      systemInstruction: systemPrompt ?? agent.systemPrompt,
      generationConfig: {
        maxOutputTokens: maxTokens ?? agent.maxTokens ?? 4096,
        temperature: temperature ?? agent.temperature ?? 0.3,
      },
    });

    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const lastUserMsg = history.pop();
    if (!lastUserMsg || lastUserMsg.role !== 'user') {
      throw new Error('Conversation must end with a user message for Google provider');
    }

    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(lastUserMsg.parts[0]!.text);

    let accumulated = '';
    for await (const chunk of result.stream) {
      const text = chunk.text();
      accumulated += text;
      yield {
        delta: text,
        done: false,
        agentId: agent.id,
      };
    }

    const finalResponse = await result.response;
    const usage = finalResponse.usageMetadata;

    yield {
      delta: '',
      done: true,
      fullText: accumulated,
      agentId: agent.id,
      usage: {
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
        cachedTokens: usage?.cachedContentTokenCount ?? 0,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Retry logic
  // -----------------------------------------------------------------------

  private async withRetry<T>(
    policy: RetryPolicy,
    fn: (attempt: number) => Promise<T>
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < policy.maxAttempts; attempt++) {
      try {
        return await fn(attempt);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < policy.maxAttempts - 1) {
          const delay = this.computeDelay(policy, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  private computeDelay(policy: RetryPolicy, attempt: number): number {
    const exponential = policy.baseDelayMs * Math.pow(policy.backoffMultiplier, attempt);
    const capped = Math.min(exponential, policy.maxDelayMs);
    if (policy.jitter) {
      return Math.random() * capped;
    }
    return capped;
  }

  /** Wrap a promise with a timeout. Rejects with a timeout error if the deadline is exceeded. */
  private withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${label} timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      promise.then(
        (value) => { clearTimeout(timer); resolve(value); },
        (err) => { clearTimeout(timer); reject(err); },
      );
    });
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private buildMetadata(
    agent: AgentDefinition,
    usage: {
      inputTokens: number;
      outputTokens: number;
      cachedTokens: number;
      latencyMs: number;
      retryCount: number;
    }
  ): TaskMetadata {
    const pricing = MODEL_PRICING[agent.model];
    let estimatedCost = 0;
    if (pricing) {
      estimatedCost =
        (usage.inputTokens / 1_000_000) * pricing.input +
        (usage.outputTokens / 1_000_000) * pricing.output +
        (usage.cachedTokens / 1_000_000) * (pricing.cachedInput ?? pricing.input);
    }

    return {
      agentId: agent.id,
      model: agent.model,
      provider: agent.provider,
      timestamp: new Date().toISOString(),
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cachedTokens: usage.cachedTokens,
      latencyMs: usage.latencyMs,
      retryCount: usage.retryCount,
      estimatedCost,
    };
  }

  private defaultModelForProvider(provider: ModelProvider): string {
    switch (provider) {
      case ModelProvider.anthropic:
        return 'claude-haiku-4-5';
      case ModelProvider.google:
        return 'gemini-2.0-flash';
      default:
        return 'gemini-2.0-flash';
    }
  }

  private providerError(provider: string, agentId: string): Error {
    const err = new Error(
      `${provider} provider is not configured (missing API key) — agent ${agentId} requires ${provider}`
    );
    err.name = 'ProviderUnavailableError';
    return err;
  }
}
