# Agentic AI Hardening Summary (2026-05)

This document summarizes the production hardening applied to
`agentic_ai/` and `mcp_server/`.

## Tooling + dependency management

- `pyproject.toml` is the source of truth: ruff (lint+format), mypy
  strict, pytest config, coverage settings, bandit config, all in one
  file.
- Dependencies are profiled into `requirements/{base,cloud-aws,cloud-azure,cloud-gcp,dev,all}.txt`.
  `requirements.txt` is a backwards-compatible shim that pulls in
  `base.txt`.
- `.pre-commit-config.yaml` runs ruff + mypy + bandit + gitleaks +
  whitespace hygiene on every commit.
- `.editorconfig`, `.dockerignore` added.

## Containerization

- Multi-stage `Dockerfile` with explicit targets: `mcp` (default),
  `api`, `dev`. Non-root user (UID 10001), tini as PID 1, copyable
  venv, multi-arch via Buildx.
- `docker-compose.yml` rewritten: removed obsolete `version:`,
  added resource limits, read-only root fs, `no-new-privileges`,
  dropped capabilities, ports bound to `127.0.0.1`, healthchecks,
  `monitoring` profile for Prometheus / Grafana / OTel collector.
- `monitoring/prometheus.yml`, `monitoring/otel/config.yaml`, Grafana
  provisioning + a starter pipeline dashboard.

## Cross-cutting primitives (new modules)

All in `mcp_server/`:

| Module               | Purpose                                                       |
| -------------------- | ------------------------------------------------------------- |
| `errors.py`          | Typed exceptions with retryable classification.               |
| `security.py`        | Secret redaction, sanitization, rate limiter, constant-time. |
| `observability.py`   | OTel traces + Prometheus metrics + LLM cost recording.        |
| `resilience.py`      | tenacity retries + in-process circuit breaker + timeouts.    |
| `health.py`          | Liveness / readiness / deep health.                           |
| `middleware.py`      | `tool_middleware()` wrapper applied around every MCP tool.    |
| `cost.py`            | Per-provider/model cost estimation.                           |

Existing modules updated:

- `logging_config.py` — JSON logs, OTel `trace_id` correlation, secret
  redaction processor.
- `app.py` — calls `configure_observability()` at boot; warms metrics
  registry.

## Settings

`agentic_ai/config/settings.py` rewritten with:

- Strict `Literal` types for `environment`, `default_llm_provider`,
  `acp_backend`, `log_level`, `otel_exporter_otlp_protocol`.
- `SecretStr` for every credential. New `get_provider_key()` helper.
- Production fail-fast: missing default-provider key raises at boot.
- Field-level `ge` / `le` bounds on numeric settings.
- New OTel + cost + resilience settings (timeouts, attempts, breaker
  thresholds, sample ratio, daily cost budget).
- GCP settings added.

## Pipeline + agents

- `agents/base_agent.py` — `BaseAgent.invoke()` wraps `process()` in
  retry + circuit breaker + timeout + OTel span + Prometheus metrics
  and runs sync agent code on a worker thread so the event loop stays
  responsive.
- `core/pipeline.py` — every stage runs inside a child span; nodes use
  a shared `_run_agent_node` helper for tracing + metrics + error
  capture. `process_article` has a top-level deadline and emits
  `synthora_pipeline_*` metrics.

## CI

`.github/workflows/agentic-ai-ci.yml` adds jobs:

- `lint` — ruff
- `typecheck` — mypy (continue-on-error until strict baseline is clean)
- `test` — pytest matrix py3.11 + py3.12 with Redis service container
- `security` — bandit (SARIF), pip-audit (strict), gitleaks
- `build-image` — Docker Buildx build + Trivy scan + Syft SBOM
- `summary` — aggregate gate

## Tests added

`agentic_ai/tests/`:

- `conftest.py` — fixtures (`fresh_metrics_registry`, `reset_circuit_breakers`).
- `test_security_redaction.py` — redaction, sanitization, rate limiter.
- `test_resilience.py` — retries, timeouts, circuit breaker.
- `test_errors.py` — typed errors.
- `test_observability.py` — metrics, spans, decorator.
- `test_cost.py` — pricing math.
- `test_settings.py` — env validation, prod fail-fast.
- `test_middleware.py` — error envelopes, rate limit, exception handling.
- `test_health.py` — liveness / readiness / health.

## Docs

- `docs/adr/0001..0004` — provider strategy, transport, ACP backend,
  observability.
- `docs/runbook/incident-response.md` — 5xx spikes, cost spikes, ACP
  degradation, wedged pipeline, crashloops.
- `docs/security.md` — threat model + control matrix.
- `docs/HARDENING.md` — this document.

## Second pass — integration + infrastructure

- `api.py` rewired: OTel FastAPI/HTTPX/logging instrumentation,
  `/metrics`, `/healthz`, `/readyz`, token-bucket rate limiting,
  trusted-host middleware, structured `MCPError` handling, lifespan
  hooks, OpenAPI docs gated off in production.
- `tool_middleware` applied to all 28 MCP tools — uniform span +
  metrics + error envelope + optional rate limit. Tool schemas verified
  preserved through the wrapper.
- ACP tools emit `synthora_acp_messages_total` / `acp_agents_registered`.
- Cloud adapters hardened: AWS Lambda + Azure Functions rewritten
  (package imports, observability, typed errors, reused event loop,
  managed identity for Azure Blob); new GCP Cloud Functions adapter
  (`gcp/cloud_function.py`, HTTP + Pub/Sub).
- `observability.py`: removed module-load tracer caching; added
  `metrics_text()`; gated ConsoleSpanExporter behind `DEBUG`.
- `logging_config.py`: renderer-aware processor chain (no
  `format_exc_info` under ConsoleRenderer).
- Infrastructure:
  - `infrastructure/kubernetes/agentic-ai/` — deployment (api + mcp),
    service, HPA, PDB, NetworkPolicy, ServiceMonitor, ConfigMap, Secret
    template, ServiceAccount, kustomization.
  - `infrastructure/helm/agentic-ai/` — full chart.
  - `infrastructure/terraform/modules/agentic-ai/` — ECR, KMS, Secrets
    Manager, IAM, CloudWatch, optional Helm release.
- Repo automation: `.github/dependabot.yml`, `codeql-agentic-ai.yml`,
  `.github/CODEOWNERS`, `agentic_ai/CHANGELOG.md`.
- Lint baseline clean: `ruff check` + `ruff format` pass on
  `agentic_ai/` + `mcp_server/`.

## Known follow-ups

- mypy strict baseline — fix remaining `Any`s; flip `continue-on-error`
  off in CI once clean.
- Coverage ratchet — currently a 30% gate (~55% actual). Raise it as the
  legacy `orchestration/` and cloud adapters gain tests.
- LangChain 1.x migration — clears the 3 residual HIGH CVEs
  (`CVE-2026-34070`, `CVE-2025-64439`, `CVE-2026-45134`) that are fixed
  only on the 1.x line. Tracked in `.trivyignore` with non-exploitability
  rationale; the migration is a separate, test-gated effort.
- Distributed rate limiter — current `TokenBucketRateLimiter` is
  in-process; swap with Redis Lua for multi-replica HTTP deployments.
- ECS Fargate task definition — the Terraform module provisions ECR +
  secrets + KMS + optional Helm release; a Fargate service is not yet
  modeled.
- Distroless / Chainguard base image — would clear most of the
  unfixable Debian OS CVEs; deferred (breaks the curl healthcheck +
  needs reworking tini/shell assumptions).
