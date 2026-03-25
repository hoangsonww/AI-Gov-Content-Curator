# SynthoraAI Python Orchestration Layer

Enterprise-grade orchestration for the LangGraph article processing pipeline. Adds content supervision, cost budgeting, error recovery with circuit breaking, dead-letter queuing, and concurrent batch processing.

## Architecture

```
Article payload
  -> ContentSupervisor.process_article(article, mode)
    -> classify_article()     # Routing heuristics (content length, source domain)
    -> build_execution_plan() # Topological step ordering with parallel groups
    -> CostBudgetManager.can_afford()
    -> execute_plan()         # Delegates to AgenticPipeline (LangGraph)
    -> Quality gate           # Score >= 0.7 threshold
  <- Result with routing, plan_id, budget_check, quality_gate metadata
```

## Modules

| Module | Description |
|---|---|
| `supervisor.py` | `ContentSupervisor` — article routing, plan execution, quality gate |
| `agent_registry.py` | Thread-safe `AgentRegistry` with 7 default agents, capability-based lookup, fallback selection |
| `cost_budget.py` | `CostBudgetManager` — per-model cost estimation, daily budget tracking, plan optimisation |
| `error_recovery.py` | `ErrorRecoveryEngine` — 17 error-type async strategies, exponential backoff, circuit breaker |
| `dead_letter.py` | `DeadLetterQueue` — failed article storage with async replay through the supervisor |
| `batch_processor.py` | `ArticleBatchProcessor` — concurrent processing with semaphore, priority ordering, per-item retry |
| `types.py` | Enums (`ProcessingMode`, `AgentErrorType`, `ModelProvider`), dataclasses, multi-provider pricing table |

## Default Agents

| Agent | Provider | Model | Cost Tier | Capabilities |
|---|---|---|---|---|
| content-analyzer | Google | gemini-1.5-flash | MEDIUM | content_analysis, entity_extraction |
| summarizer | Google | gemini-1.5-flash | MEDIUM | summarization |
| classifier | Google | gemini-1.5-flash | LOW | classification, topic_detection |
| sentiment-analyzer | Google | gemini-1.5-flash | LOW | sentiment_analysis, bias_detection |
| quality-checker | Google | gemini-1.5-flash | LOW | quality_scoring, hallucination_detection |
| content-supervisor | Anthropic | claude-sonnet-4-6 | HIGH | supervision, escalation_handling |
| batch-processor | Google | gemini-2.0-flash-lite | LOW | batch_processing |

## Processing Modes

| Mode | Description |
|---|---|
| `full` | All five agents execute in topological order |
| `fast` | Summariser + classifier only (no quality loop) |
| `enrich` | Adds sentiment and quality scoring on top of existing summary |
| `reprocess` | Full run with cache bypass |

## Error Recovery Strategies

The `ErrorRecoveryEngine` handles 17 distinct error types:

- **rate_limited** — Exponential backoff with full jitter
- **context_overflow** — Content truncation to 8 000 chars
- **tool_failure** — Retry with failing tool disabled
- **hallucination_detected** — Escalate to content-supervisor
- **timeout** — Retry on faster model (gemini-2.0-flash-lite)
- **provider_unavailable** — Cross-provider failover (Google <-> Anthropic)
- **budget_exceeded** — Abort with signal
- **circular_handoff** — Terminate cycle
- **crawler_failure** — Skip URL, continue batch
- **embedding_failure** — Retry once, then degrade to keyword search
- **newsletter_send_failure** — Queue for 5-minute retry

Circuit breaker trips after 3 failures within 5 minutes; 60-second cooldown.

## Usage

```python
from agentic_ai.orchestration import ContentSupervisor, ArticleBatchProcessor

# Single article
supervisor = ContentSupervisor(daily_budget_usd=5.0)
result = await supervisor.process_article(
    {"id": "art-1", "content": "...", "url": "https://...", "source": "gov.uk"},
    mode="full",
)

# Batch processing
processor = ArticleBatchProcessor(supervisor=supervisor, concurrency=3)
batch = await processor.process_batch(articles, mode="fast")
print(f"Succeeded: {batch.succeeded}, Failed: {batch.failed}")

# Retry failures
retry_batch = await processor.retry_failed(batch, mode="full")
```

## Pricing Table

Pricing is defined in `types.py` (USD per 1M tokens):

| Model | Input | Output | Cached |
|---|---|---|---|
| claude-opus-4-6 | $15.00 | $75.00 | $1.50 |
| claude-sonnet-4-6 | $3.00 | $15.00 | $0.30 |
| claude-haiku-4-5 | $0.80 | $4.00 | $0.08 |
| gemini-2.0-flash | $0.10 | $0.40 | $0.025 |
| gemini-2.0-flash-lite | $0.075 | $0.30 | $0.019 |
| gemini-1.5-flash | $0.075 | $0.30 | $0.019 |
| gemini-1.5-pro | $1.25 | $5.00 | $0.313 |
| gpt-4o | $2.50 | $10.00 | $1.25 |
| gpt-4o-mini | $0.15 | $0.60 | $0.075 |
