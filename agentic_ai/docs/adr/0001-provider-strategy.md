# ADR 0001 — LLM Provider Strategy

- **Status**: Accepted
- **Date**: 2026-05-14
- **Decision-makers**: SynthoraAI engineering

## Context

The agentic pipeline calls a large language model for every article. We
need to support multiple providers (Google, OpenAI, Anthropic, Cohere) so
that:

1. We can fail over when a provider has an outage.
2. We can route by cost / capability per agent stage.
3. We can swap models without code changes when pricing or capabilities
   shift.

LangChain provides a thin abstraction (`BaseChatModel`) that covers the
four target providers.

## Decision

- Use LangChain's `BaseChatModel` per provider, configured from
  `Settings.default_llm_provider` and `Settings.default_model`.
- API keys are stored as `pydantic.SecretStr` so they never leak through
  string coercion. Logging passes through `mcp_server.security`'s
  redaction processor as a second line of defense.
- Default provider is Google Gemini Flash for cost; agents may opt into a
  stronger model by overriding `llm` in their constructor.
- All LLM calls are wrapped with retry + circuit breaker + per-call
  timeout via `mcp_server.resilience.guarded_call`. Retries only fire for
  classified-transient errors (timeouts, 5xx, rate limits).

## Consequences

- **Pros**: providers are interchangeable; failure of one provider does
  not cascade; cost is observable via Prometheus.
- **Cons**: LangChain abstracts provider-specific features (e.g.
  Anthropic tool use, OpenAI function-calling). When we need those, we
  bypass `BaseChatModel` and use the provider SDK directly.

## Alternatives considered

- **Litellm** — single dependency for many providers. Rejected because we
  already depend on LangChain for prompt templating + LangGraph.
- **Direct provider SDKs everywhere** — too much per-agent boilerplate.
