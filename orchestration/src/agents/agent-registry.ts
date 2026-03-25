/**
 * AgentRegistry: central directory for all registered agents.
 * Supports capability-based lookup, fallback chains, and dynamic registration.
 */

import {
  AgentDefinition,
  ModelProvider,
  ChatIntentType,
} from './types';

import {
  SUPERVISOR_SYSTEM_PROMPT,
} from './prompts/system/supervisor';
import { ARTICLE_SEARCH_SYSTEM_PROMPT } from './prompts/system/article-search';
import { ARTICLE_QA_SYSTEM_PROMPT } from './prompts/system/article-qa';
import { TOPIC_EXPLORER_SYSTEM_PROMPT } from './prompts/system/topic-explorer';
import { TREND_ANALYST_SYSTEM_PROMPT } from './prompts/system/trend-analyst';
import { BIAS_ANALYZER_SYSTEM_PROMPT } from './prompts/system/bias-analyzer';
import { CLARIFICATION_SYSTEM_PROMPT } from './prompts/system/clarification';
import { QUALITY_REVIEWER_SYSTEM_PROMPT } from './prompts/system/quality-reviewer';

/** Maps ChatIntentType values to capability tags used for routing. */
const INTENT_CAPABILITY_MAP: Record<ChatIntentType, string> = {
  [ChatIntentType.article_search]: 'article_search',
  [ChatIntentType.article_qa]: 'article_qa',
  [ChatIntentType.topic_exploration]: 'topic_exploration',
  [ChatIntentType.trend_analysis]: 'trend_analysis',
  [ChatIntentType.bias_analysis]: 'bias_analysis',
  [ChatIntentType.clarification]: 'clarification',
  [ChatIntentType.general_chat]: 'general_chat',
  [ChatIntentType.quality_review]: 'quality_review',
};

export { INTENT_CAPABILITY_MAP };

/**
 * Central registry for agent definitions.
 * Thread-safe for synchronous Node.js usage.
 */
export class AgentRegistry {
  private readonly agents: Map<string, AgentDefinition> = new Map();

  /**
   * Register an agent definition. Overwrites any existing agent with the same id.
   * @param agent - The agent definition to register.
   */
  register(agent: AgentDefinition): void {
    this.agents.set(agent.id, agent);
  }

  /**
   * Retrieve an agent by its unique identifier.
   * Returns undefined when the agent is not found — never throws.
   * @param id - The agent identifier.
   */
  get(id: string): AgentDefinition | undefined {
    return this.agents.get(id);
  }

  /**
   * List all registered agents.
   */
  listAll(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  /**
   * List agents that possess a specific capability tag.
   * @param capability - Capability tag to filter by.
   */
  listByCapability(capability: string): AgentDefinition[] {
    return Array.from(this.agents.values()).filter((a) =>
      a.capabilities.includes(capability)
    );
  }

  /**
   * Follow the fallback chain starting from the given agent id.
   * Returns the first reachable fallback agent, or undefined if none exists.
   * Stops after 10 hops to prevent infinite loops.
   * @param agentId - Starting agent id.
   */
  getFallback(agentId: string): AgentDefinition | undefined {
    let current = this.agents.get(agentId);
    let hops = 0;
    while (current && current.fallbackAgentId && hops < 10) {
      const next = this.agents.get(current.fallbackAgentId);
      if (!next) return undefined;
      current = next;
      hops++;
    }
    // Only return if we actually moved to a different agent
    const original = this.agents.get(agentId);
    if (current && current.id !== original?.id) return current;
    return undefined;
  }

  /**
   * Remove an agent from the registry.
   * @param id - The agent identifier to remove.
   * @returns true if the agent existed and was removed.
   */
  remove(id: string): boolean {
    return this.agents.delete(id);
  }

  /**
   * Create a registry pre-populated with the 8 default chat agents
   * that cover all ChatIntentType values. Anthropic agents have Google
   * fallbacks and vice versa to provide cross-provider resilience.
   */
  static createWithDefaults(): AgentRegistry {
    const registry = new AgentRegistry();

    const defaults: AgentDefinition[] = [
      {
        id: 'supervisor',
        name: 'Chat Supervisor',
        description: 'Orchestrates sub-agents and synthesizes final responses',
        provider: ModelProvider.anthropic,
        model: 'claude-sonnet-4-6',
        capabilities: ['routing', 'synthesis', 'general_chat'],
        systemPrompt: SUPERVISOR_SYSTEM_PROMPT,
        fallbackAgentId: 'supervisor-google',
        maxTokens: 4096,
        temperature: 0.3,
      },
      {
        id: 'supervisor-google',
        name: 'Chat Supervisor (Google)',
        description: 'Google-backed supervisor fallback',
        provider: ModelProvider.google,
        model: 'gemini-2.0-flash',
        capabilities: ['routing', 'synthesis', 'general_chat'],
        systemPrompt: SUPERVISOR_SYSTEM_PROMPT,
        maxTokens: 4096,
        temperature: 0.3,
      },
      {
        id: 'article-search',
        name: 'Article Search Agent',
        description: 'Retrieves relevant government articles via RAG',
        provider: ModelProvider.anthropic,
        model: 'claude-haiku-4-5',
        capabilities: ['article_search', 'retrieval'],
        systemPrompt: ARTICLE_SEARCH_SYSTEM_PROMPT,
        tools: ['search_articles', 'filter_by_date', 'filter_by_source'],
        fallbackAgentId: 'article-search-google',
        maxTokens: 2048,
        temperature: 0.1,
      },
      {
        id: 'article-search-google',
        name: 'Article Search Agent (Google)',
        description: 'Google-backed article search fallback',
        provider: ModelProvider.google,
        model: 'gemini-2.0-flash-lite',
        capabilities: ['article_search', 'retrieval'],
        systemPrompt: ARTICLE_SEARCH_SYSTEM_PROMPT,
        tools: ['search_articles', 'filter_by_date', 'filter_by_source'],
        maxTokens: 2048,
        temperature: 0.1,
      },
      {
        id: 'article-qa',
        name: 'Article Q&A Agent',
        description: 'Answers questions grounded in specific articles',
        provider: ModelProvider.anthropic,
        model: 'claude-sonnet-4-6',
        capabilities: ['article_qa', 'grounded_qa'],
        systemPrompt: ARTICLE_QA_SYSTEM_PROMPT,
        tools: ['get_article_content', 'cite_source'],
        fallbackAgentId: 'article-qa-google',
        maxTokens: 4096,
        temperature: 0.2,
      },
      {
        id: 'article-qa-google',
        name: 'Article Q&A Agent (Google)',
        description: 'Google-backed article Q&A fallback',
        provider: ModelProvider.google,
        model: 'gemini-1.5-pro',
        capabilities: ['article_qa', 'grounded_qa'],
        systemPrompt: ARTICLE_QA_SYSTEM_PROMPT,
        tools: ['get_article_content', 'cite_source'],
        maxTokens: 4096,
        temperature: 0.2,
      },
      {
        id: 'topic-explorer',
        name: 'Topic Explorer Agent',
        description: 'Explores topics across government content landscape',
        provider: ModelProvider.anthropic,
        model: 'claude-sonnet-4-6',
        capabilities: ['topic_exploration', 'summarization'],
        systemPrompt: TOPIC_EXPLORER_SYSTEM_PROMPT,
        tools: ['search_articles', 'get_related_topics'],
        fallbackAgentId: 'topic-explorer-google',
        maxTokens: 3072,
        temperature: 0.4,
      },
      {
        id: 'topic-explorer-google',
        name: 'Topic Explorer Agent (Google)',
        description: 'Google-backed topic explorer fallback',
        provider: ModelProvider.google,
        model: 'gemini-2.0-flash',
        capabilities: ['topic_exploration', 'summarization'],
        systemPrompt: TOPIC_EXPLORER_SYSTEM_PROMPT,
        tools: ['search_articles', 'get_related_topics'],
        maxTokens: 3072,
        temperature: 0.4,
      },
      {
        id: 'trend-analyst',
        name: 'Trend Analyst Agent',
        description: 'Identifies trends and patterns in government policy coverage',
        provider: ModelProvider.anthropic,
        model: 'claude-sonnet-4-6',
        capabilities: ['trend_analysis', 'data_analysis'],
        systemPrompt: TREND_ANALYST_SYSTEM_PROMPT,
        tools: ['get_article_timeseries', 'compute_trend'],
        fallbackAgentId: 'trend-analyst-google',
        maxTokens: 4096,
        temperature: 0.2,
      },
      {
        id: 'trend-analyst-google',
        name: 'Trend Analyst Agent (Google)',
        description: 'Google-backed trend analyst fallback',
        provider: ModelProvider.google,
        model: 'gemini-1.5-pro',
        capabilities: ['trend_analysis', 'data_analysis'],
        systemPrompt: TREND_ANALYST_SYSTEM_PROMPT,
        tools: ['get_article_timeseries', 'compute_trend'],
        maxTokens: 4096,
        temperature: 0.2,
      },
      {
        id: 'bias-analyzer',
        name: 'Bias Analyzer Agent',
        description: 'Detects framing, bias, and perspective in articles',
        provider: ModelProvider.anthropic,
        model: 'claude-opus-4-6',
        capabilities: ['bias_analysis', 'media_literacy'],
        systemPrompt: BIAS_ANALYZER_SYSTEM_PROMPT,
        fallbackAgentId: 'bias-analyzer-google',
        maxTokens: 4096,
        temperature: 0.1,
      },
      {
        id: 'bias-analyzer-google',
        name: 'Bias Analyzer Agent (Google)',
        description: 'Google-backed bias analyzer fallback',
        provider: ModelProvider.google,
        model: 'gemini-1.5-pro',
        capabilities: ['bias_analysis', 'media_literacy'],
        systemPrompt: BIAS_ANALYZER_SYSTEM_PROMPT,
        maxTokens: 4096,
        temperature: 0.1,
      },
      {
        id: 'clarification',
        name: 'Clarification Agent',
        description: 'Asks clarifying questions to resolve ambiguous queries',
        provider: ModelProvider.anthropic,
        model: 'claude-haiku-4-5',
        capabilities: ['clarification', 'dialogue_management'],
        systemPrompt: CLARIFICATION_SYSTEM_PROMPT,
        fallbackAgentId: 'clarification-google',
        maxTokens: 1024,
        temperature: 0.5,
      },
      {
        id: 'clarification-google',
        name: 'Clarification Agent (Google)',
        description: 'Google-backed clarification fallback',
        provider: ModelProvider.google,
        model: 'gemini-2.0-flash-lite',
        capabilities: ['clarification', 'dialogue_management'],
        systemPrompt: CLARIFICATION_SYSTEM_PROMPT,
        maxTokens: 1024,
        temperature: 0.5,
      },
      {
        id: 'quality-reviewer',
        name: 'Quality Reviewer Agent',
        description: 'Evaluates and scores response quality before delivery',
        provider: ModelProvider.anthropic,
        model: 'claude-sonnet-4-6',
        capabilities: ['quality_review', 'evaluation'],
        systemPrompt: QUALITY_REVIEWER_SYSTEM_PROMPT,
        fallbackAgentId: 'quality-reviewer-google',
        maxTokens: 2048,
        temperature: 0.1,
      },
      {
        id: 'quality-reviewer-google',
        name: 'Quality Reviewer Agent (Google)',
        description: 'Google-backed quality reviewer fallback',
        provider: ModelProvider.google,
        model: 'gemini-2.0-flash',
        capabilities: ['quality_review', 'evaluation'],
        systemPrompt: QUALITY_REVIEWER_SYSTEM_PROMPT,
        maxTokens: 2048,
        temperature: 0.1,
      },
    ];

    for (const agent of defaults) {
      registry.register(agent);
    }

    return registry;
  }
}
