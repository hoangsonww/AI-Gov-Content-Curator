/**
 * Prompt caching strategy for Anthropic's prompt cache feature.
 * Structures prompts into cacheable layers to maximize cache hit rates.
 */

import { AgentDefinition, Message } from '../types';

/** A single layer in a cached prompt structure. */
export interface CacheLayer {
  /** Layer identifier for debugging. */
  name: string;
  /** The text content of this layer. */
  content: string;
  /** Whether this layer should be marked for caching. */
  cacheable: boolean;
  /** Estimated token count (approximate, 4 chars per token). */
  estimatedTokens: number;
}

/** A fully assembled cached prompt ready to send to the Anthropic API. */
export interface CachedPrompt {
  /** The system prompt with cache control annotations. */
  system: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>;
  /** The user/assistant message turns. */
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Total estimated tokens across all layers. */
  totalEstimatedTokens: number;
  /** Estimated tokens that may be served from cache. */
  estimatedCachedTokens: number;
}

/** Estimated cache savings for a prompt construction. */
export interface CacheSavingsEstimate {
  /** Tokens expected to be cached. */
  cachedTokens: number;
  /** Tokens that must be re-processed. */
  freshTokens: number;
  /** Estimated cost saving in USD (using claude-sonnet-4-6 pricing as baseline). */
  estimatedSavingUsd: number;
  /** Cache efficiency ratio 0-1. */
  cacheRatio: number;
}

/**
 * Builds and manages prompt caching strategy using up to 5 hierarchical layers.
 * Layer order (most stable to least stable):
 *   1. Base grounding rules (near-permanent)
 *   2. Agent system prompt (stable per agent type)
 *   3. Tool definitions (stable per session)
 *   4. Conversation history summary (session-level)
 *   5. Recent messages (dynamic, not cached)
 */
export class PromptCacheStrategy {
  /**
   * Build a cached prompt from the given components.
   *
   * @param agent - The agent definition providing system prompt and tools.
   * @param groundingRules - Grounding rule strings to include in the cached preamble.
   * @param conversationSummary - Running summary of older conversation turns.
   * @param recentMessages - Recent message turns that change each request.
   * @returns A CachedPrompt ready for use with the Anthropic messages API.
   */
  buildCachedPrompt(
    agent: AgentDefinition,
    groundingRules: readonly string[],
    conversationSummary: string,
    recentMessages: Message[]
  ): CachedPrompt {
    const layers = this.buildLayers(agent, groundingRules, conversationSummary);

    // Build system blocks — layers 1-3 are cached, layer 4 may be cached if non-trivial
    const systemBlocks: CachedPrompt['system'] = [];

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (!layer) continue;
      if (layer.cacheable && layer.content.trim()) {
        systemBlocks.push({
          type: 'text',
          text: layer.content,
          cache_control: { type: 'ephemeral' },
        });
      } else if (layer.content.trim()) {
        systemBlocks.push({ type: 'text', text: layer.content });
      }
    }

    // Build message turns from recent messages (layer 5 — not cached)
    const messages: CachedPrompt['messages'] = recentMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const totalEstimatedTokens = layers.reduce((sum, l) => sum + l.estimatedTokens, 0);
    const estimatedCachedTokens = layers
      .filter((l) => l.cacheable)
      .reduce((sum, l) => sum + l.estimatedTokens, 0);

    return {
      system: systemBlocks,
      messages,
      totalEstimatedTokens,
      estimatedCachedTokens,
    };
  }

  /**
   * Estimate the cache savings for a given set of layers.
   *
   * @param totalInputTokens - Total input tokens without caching.
   * @param cachedTokens - Tokens expected to be served from cache.
   * @returns Cost savings estimate using claude-sonnet-4-6 pricing.
   */
  estimateCacheSavings(
    totalInputTokens: number,
    cachedTokens: number
  ): CacheSavingsEstimate {
    const freshTokens = totalInputTokens - cachedTokens;
    const cacheRatio = totalInputTokens > 0 ? cachedTokens / totalInputTokens : 0;

    // claude-sonnet-4-6: input $3/M, cached input $0.375/M
    const standardCostPerToken = 3 / 1_000_000;
    const cachedCostPerToken = 0.375 / 1_000_000;

    const standardCost = totalInputTokens * standardCostPerToken;
    const actualCost =
      freshTokens * standardCostPerToken + cachedTokens * cachedCostPerToken;
    const estimatedSavingUsd = Math.max(0, standardCost - actualCost);

    return {
      cachedTokens,
      freshTokens,
      estimatedSavingUsd,
      cacheRatio,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildLayers(
    agent: AgentDefinition,
    groundingRules: readonly string[],
    conversationSummary: string
  ): CacheLayer[] {
    // Layer 1: Base grounding rules (most stable — cache forever)
    const groundingText = [
      '## Grounding Rules (apply to all responses)',
      groundingRules.map((r, i) => `${i + 1}. ${r}`).join('\n'),
    ].join('\n');

    // Layer 2: Agent system prompt (stable per agent type)
    const systemText = [
      `## Agent: ${agent.name}`,
      agent.description,
      agent.systemPrompt,
    ].join('\n\n');

    // Layer 3: Tool definitions (stable per session)
    const toolsText =
      agent.tools && agent.tools.length > 0
        ? ['## Available Tools', agent.tools.map((t) => `- ${t}`).join('\n')].join('\n')
        : '';

    // Layer 4: Conversation summary (session-level, cache if non-trivial)
    const summaryText = conversationSummary.trim()
      ? ['## Conversation Summary (prior context)', conversationSummary].join('\n\n')
      : '';

    const estimate = (text: string) => Math.ceil(text.length / 4);

    return [
      {
        name: 'grounding_rules',
        content: groundingText,
        cacheable: true,
        estimatedTokens: estimate(groundingText),
      },
      {
        name: 'system_prompt',
        content: systemText,
        cacheable: true,
        estimatedTokens: estimate(systemText),
      },
      {
        name: 'tool_definitions',
        content: toolsText,
        cacheable: true,
        estimatedTokens: estimate(toolsText),
      },
      {
        name: 'conversation_summary',
        content: summaryText,
        cacheable: summaryText.length > 200,
        estimatedTokens: estimate(summaryText),
      },
    ];
  }
}
