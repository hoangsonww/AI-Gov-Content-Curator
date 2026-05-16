# Incident Response Runbook — Agentic Pipeline

This runbook covers common operational issues. Symptoms → diagnosis → action.

## 1. Pipeline 5xx / errors spike

**Symptoms**
- `synthora_pipeline_runs_total{status="failed"}` > 5% of total
- Sentry / OTel error log volume jumps

**Diagnose**
1. Check provider status pages (OpenAI, Anthropic, Google, Cohere)
2. Filter logs by `error_type` to identify class:
   - `TransientUpstreamError` → provider outage
   - `TimeoutError_` → provider slow / network latency
   - `CircuitOpenError` → already breaker-protected
   - `ConfigurationError` → deployment regression
3. Check `synthora_circuit_breaker_state` panel — any breakers open?

**Mitigate**
- Provider outage: switch `DEFAULT_LLM_PROVIDER` env var to a healthy
  provider, restart pods. Confirm the new provider's key is set.
- Slow provider: tune `LLM_REQUEST_TIMEOUT_SECONDS` upward only if the
  median is rising (don't paper over true failure).
- Configuration: roll back the most recent deployment.

## 2. Cost spike

**Symptoms**
- `synthora_llm_cost_usd_total` rate exceeds `DAILY_COST_BUDGET_USD` / 24h
- Cost alert from Prometheus

**Diagnose**
1. Identify which agent + provider+model is driving cost (Grafana panel
   "LLM Cost (USD) cumulative").
2. Check if input sizes have grown (`synthora_mcp_tool_duration_seconds`
   for `process_article` correlated with `MCP_MAX_CONTENT_CHARS`).
3. Check for retry storm: `synthora_retries_total{outcome="failure"}`.

**Mitigate**
- Lower `MAX_TOKENS` for the offending agent.
- Switch the offending agent to a cheaper model (e.g. `gemini-1.5-flash`).
- Cap `MCP_MAX_BATCH_ITEMS` if a caller is sending oversized batches.
- Pause processing via feature flag (`ENABLE_*` env vars).

## 3. ACP / Redis degradation

**Symptoms**
- `acp_preflight` reports `ready=false`
- ACP send/recv latency rises

**Diagnose**
1. `redis-cli -h $REDIS_HOST PING` (should reply `PONG`)
2. `redis-cli INFO memory` — check `maxmemory_policy` and `used_memory`
3. Check Redis container health in `docker compose ps`

**Mitigate**
- Restart Redis container. Persistence on; small loss is acceptable.
- If memory full: bump `--maxmemory` for the container.
- For sustained issues, fail over to memory backend by setting
  `ACP_ENABLED=false` (downstream agents must tolerate this).

## 4. Pipeline wedged / no progress

**Symptoms**
- `synthora_job_queue_depth{status="processing"}` flat-high
- `synthora_pipeline_duration_seconds` shows no completions

**Diagnose**
1. `make mcp-preflight` — confirm readiness
2. Inspect the active span in your trace backend — which stage is
   hanging?
3. Look for `CircuitOpenError` floods → upstream wedged

**Mitigate**
- Drain by stopping new requests; let in-flight time out at `AGENT_TIMEOUT`
  * `MAX_ITERATIONS`.
- If unavoidable, restart the MCP container — in-flight jobs return
  `error` status; clients retry idempotently.

## 5. Container CrashLoopBackOff

1. `docker logs synthora-mcp` / `kubectl logs ...` — first failure log
2. Common causes:
   - Missing required env var in production → `ConfigurationError`
   - Redis unreachable + `ACP_BACKEND=redis` → startup raises
   - OTel endpoint misconfigured → boot-time exporter init fails
     (currently soft-fails, but verify)
3. Fix env, redeploy.

## Useful commands

```bash
make mcp-preflight                # readiness JSON
make test                         # unit tests
make security                     # bandit + pip-audit
docker compose ps                 # service health
curl -s :9090/api/v1/query?query=synthora_pipeline_runs_total
```
