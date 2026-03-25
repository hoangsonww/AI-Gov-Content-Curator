# @synthoraai/orchestration

Agent orchestration layer for SynthoraAI — dual-provider LLM client, chat supervisor, context management, cost tracking, and enterprise observability.

## Architecture

The orchestration package powers the **chat experience** in the SynthoraAI frontend. It wraps Anthropic (Claude) and Google (Gemini) APIs behind a unified interface with automatic provider failover, intent-based agent routing, and budget enforcement.

```
User query
  -> ChatSupervisor.chat(sessionId, message)
    -> classifyIntent() via supervisor agent (LLM-based with keyword fallback)
    -> routeToAgent() via capability matching from AgentRegistry
    -> DualProviderClient.generate() (Anthropic primary, Google fallback)
    -> GroundingValidator.validate() (10 grounding rules)
    -> CostTracker.recordUsage()
    -> ContextManager.addMessage()
  <- SupervisorResponse { content, intent, metadata, grounding, handoffChain }
```

## Modules

| Module | Path | Description |
|---|---|---|
| **Supervisor** | `src/supervisor/` | Intent classification, agent routing, handoff chains, health check |
| **LLM Client** | `src/llm/` | Dual-provider (Anthropic + Google) with retry, streaming, failover |
| **Agent Registry** | `src/agents/` | 16 agents with cross-provider fallback, capability-based lookup |
| **Context Manager** | `src/context/` | Session state, message history, token-aware compaction |
| **Cost Tracker** | `src/cost/` | Daily budget enforcement, per-model breakdown |
| **Config** | `src/config/` | Zod-validated environment, preflight checks |
| **Observability** | `src/observability/` | Structured JSON logging, metrics collector |
| **Schemas** | `src/schemas/` | Zod request/response validation for API boundaries |
| **Templates** | `src/templates/` | Standardised error responses with HTTP status mapping |
| **Prompts** | `src/agents/prompts/` | 8 system prompts, grounding rules, prompt caching, versioning |

## Agents

16 agents are registered by default (8 primary + 8 Google fallbacks):

| Agent | Provider | Model | Capabilities |
|---|---|---|---|
| supervisor | Anthropic | claude-sonnet-4-6 | routing, synthesis, general_chat |
| article-search | Anthropic | claude-haiku-4-5 | article_search, retrieval |
| article-qa | Anthropic | claude-sonnet-4-6 | article_qa, grounded_qa |
| topic-explorer | Anthropic | claude-sonnet-4-6 | topic_exploration, summarization |
| trend-analyst | Anthropic | claude-sonnet-4-6 | trend_analysis, data_analysis |
| bias-analyzer | Anthropic | claude-opus-4-6 | bias_analysis, media_literacy |
| clarification | Anthropic | claude-haiku-4-5 | clarification, dialogue_management |
| quality-reviewer | Anthropic | claude-sonnet-4-6 | quality_review, evaluation |

Each primary agent has a `-google` fallback variant using Gemini models.

## Setup

```bash
cd orchestration
npm install
```

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | At least one | — | Anthropic API key |
| `GOOGLE_API_KEY` | provider | — | Google AI API key |
| `ORCHESTRATION_DAILY_BUDGET_USD` | No | `10` | Daily cost cap (USD) |
| `ORCHESTRATION_MAX_CONCURRENCY` | No | `5` | Max concurrent LLM requests |
| `ORCHESTRATION_TIMEOUT_MS` | No | `60000` | Request timeout (ms) |
| `ORCHESTRATION_MAX_HANDOFF_DEPTH` | No | `5` | Max agent handoff chain depth |
| `ORCHESTRATION_MAX_ACTIVE_MESSAGES` | No | `20` | Session messages before compaction |
| `ORCHESTRATION_LOG_LEVEL` | No | `info` | Log level (debug/info/warn/error) |

## Usage

### Basic Chat

```typescript
import { ChatSupervisor } from '@synthoraai/orchestration';

const supervisor = new ChatSupervisor({
  dailyBudgetUsd: 5,
});

const response = await supervisor.chat('session-123', 'What are the latest AI regulations?');
console.log(response.content);
console.log(response.intent);      // { intent: 'article_search', ... }
console.log(response.grounding);   // { valid: true, score: 0.85, warnings: [] }
```

### Streaming

```typescript
for await (const chunk of supervisor.chatStream('session-123', 'Summarize climate policy')) {
  process.stdout.write(chunk.delta);
  if (chunk.done) {
    console.log('\nTokens:', chunk.usage);
  }
}
```

### Health Check

```typescript
const health = supervisor.healthCheck();
// { status: 'healthy', providers: ['anthropic', 'google'], warnings: [], budget: { ... } }
```

### Direct LLM Client

```typescript
import { DualProviderClient, AgentRegistry } from '@synthoraai/orchestration';

const client = new DualProviderClient();
const registry = AgentRegistry.createWithDefaults();
const agent = registry.get('article-search')!;

const result = await client.generate({
  agent,
  messages: [{ role: 'user', content: 'Find articles about healthcare' }],
});
```

### Config Validation

```typescript
import { tryLoadOrchestrationEnv, preflightCheck } from '@synthoraai/orchestration';

const envResult = tryLoadOrchestrationEnv();
if (!envResult.success) {
  console.error('Config errors:', envResult.errors);
  process.exit(1);
}

const preflight = preflightCheck(envResult.data);
if (!preflight.ready) {
  console.error('Preflight failed:', preflight.warnings);
  process.exit(1);
}
```

## Commands

```bash
npm run build     # Compile TypeScript to dist/
npm run lint      # Type-check without emitting
npm test          # Run Jest test suite
```

## File Structure

```
orchestration/
├── package.json
├── tsconfig.json
├── jest.config.js
└── src/
    ├── index.ts                          # Barrel exports
    ├── agents/
    │   ├── agent-registry.ts             # 16 agents with fallback chains
    │   ├── types.ts                      # Enums, interfaces, pricing table
    │   └── prompts/
    │       ├── index.ts                  # Prompt registry with versioning
    │       ├── grounding.ts              # 10 grounding rules + validator
    │       ├── cache-strategy.ts         # Anthropic prompt cache layers
    │       └── system/                   # 8 system prompts
    ├── llm/
    │   ├── index.ts
    │   └── dual-provider-client.ts       # Anthropic + Google unified client
    ├── supervisor/
    │   ├── index.ts
    │   └── chat-supervisor.ts            # Intent routing + handoff chains
    ├── context/
    │   ├── index.ts
    │   └── context-manager.ts            # Session state + compaction
    ├── cost/
    │   ├── index.ts
    │   └── cost-tracker.ts               # Daily budget enforcement
    ├── config/
    │   ├── index.ts
    │   └── environment.ts                # Zod env validation + preflight
    ├── observability/
    │   ├── index.ts
    │   ├── logger.ts                     # Structured JSON logging
    │   └── metrics.ts                    # Counters, histograms, gauges
    ├── schemas/
    │   ├── index.ts
    │   └── chat.ts                       # Zod request/response schemas
    └── templates/
        ├── index.ts
        └── error-responses.ts            # Standardised error templates
```
