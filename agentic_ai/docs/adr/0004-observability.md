# ADR 0004 — Observability Stack

- **Status**: Accepted
- **Date**: 2026-05-14

## Context

We need production-grade visibility into:

1. End-to-end pipeline latency + outcome.
2. Per-agent latency + LLM cost.
3. ACP throughput + queue depth.
4. Circuit breaker state and retry rates.
5. Correlation between logs and traces.

## Decision

- **Traces**: OpenTelemetry (OTLP exporter, gRPC by default, HTTP/protobuf
  optional). Spans named `pipeline.process_article`,
  `pipeline.stage.<name>`, `agent.<name>`, `mcp.tool.<name>`. Standard
  attributes follow OTel semantic conventions where possible.
- **Metrics**: Prometheus, exposed on the FastAPI HTTP service. Stdio
  MCP container does not expose `/metrics` directly; it ships via the
  OTel collector to a downstream Prometheus or compatible TSDB.
- **Logs**: structlog → JSON to stderr, enriched with `trace_id` /
  `span_id` from the current OTel span so traces and logs correlate in
  the backend.
- **Cost**: tracked as a Prometheus counter (`synthora_llm_cost_usd_total`)
  derived from token counts × pricing in `mcp_server/cost.py`.
- **Health**: three-tier endpoints — `liveness`, `readiness`, `health`.

## Consequences

- We can swap the trace backend (Tempo, Jaeger, Honeycomb, Grafana Cloud)
  by changing the OTel collector config.
- Token-count attribution requires provider SDKs to surface usage stats,
  which LangChain does inconsistently. Where unavailable, cost shows as 0.
