# Changelog — Agentic AI

All notable changes to `agentic_ai/` and `mcp_server/` are documented
here. Format loosely follows [Keep a Changelog]; versions track
`pyproject.toml`.

## [Unreleased]

### Fixed (third pass — correctness + infra reconciliation)
- `mcp_server/runtime.py`: Redis password is a `SecretStr` — it was
  passed to the Redis client directly, which would have authenticated
  with the literal masked string. Now extracts `.get_secret_value()`.
  Also wires `redis_tls`, connection/socket timeouts, and health checks.
- Agents now route every LLM call through `BaseAgent._run_chain()`,
  which applies retry + circuit breaker (shared per provider) + timeout
  + telemetry. Previously the resilience primitives existed but the
  pipeline called `chain.invoke()` directly, bypassing them.
- `BaseAgent.invoke()` no longer double-wraps resilience (was up to 9
  effective attempts); resilience lives solely in `_run_chain`.
- `process()` abstract signature corrected to sync (matches subclasses).
- Kubernetes + Helm: `OTEL_EXPORTER_OTLP_ENDPOINT` pointed at a
  non-existent `otel-collector.monitoring` Service. The repo runs the
  Splunk OTel Collector as a per-node DaemonSet — pods now export to
  `http://$(HOST_IP):4317` via a downward-API `HOST_IP` env var.
- NetworkPolicy OTel egress was namespace-scoped and would have blocked
  node-local (RFC1918) collector traffic; now allows OTLP ports
  cluster-wide. Added the missing Redis egress rule to the Helm
  NetworkPolicy.
- Container image name aligned to the repo convention
  `ghcr.io/hoangsonww/ai-curator-agentic-ai` across k8s, Helm, Terraform.
- `kustomization.yaml` migrated off deprecated `commonLabels`.

### Added (third pass)
- `infrastructure/Makefile`: `agentic-ai-build`, `agentic-ai-k8s-deploy`,
  `agentic-ai-helm-deploy`, `agentic-ai-status`, `agentic-ai-validate`
  targets; `build-images` / `push-images` include the agentic-ai image.
- Helm `otel` values block (`useNodeLocalCollector`, `otlpPort`,
  `endpoint`) for environments without a node-local collector.
- `infrastructure/DEPLOYMENT.md`: an Agentic AI Subsystem section
  (components, manifests, observability, deploy, rollback).
- Hermetic test env — conftest force-clears provider keys so a
  developer `.env` cannot make the suite non-deterministic.
- `tests/test_mcp_integration.py` — boots the real MCP server.

### Added
- Production hardening pass:
  - Cross-cutting modules: `errors`, `security`, `observability`,
    `resilience`, `health`, `middleware`, `cost`.
  - OpenTelemetry tracing + Prometheus metrics across pipeline, agents,
    MCP tools, ACP, and LLM calls.
  - Retry + circuit breaker + timeout (`guarded_call`) on every external
    call path.
  - Secret redaction in structured logs.
  - Three-tier health: liveness / readiness / deep health.
- FastAPI `api.py` rewired with OTel instrumentation, `/metrics`,
  `/healthz`, `/readyz`, rate limiting, structured error handling.
- `tool_middleware` applied to all MCP tools (span + metrics + error
  envelope + optional rate limit).
- Cloud adapters hardened (AWS Lambda, Azure Functions) and a new GCP
  Cloud Functions adapter (`gcp/cloud_function.py`).
- Containerization: multi-stage, multi-target, non-root Dockerfile;
  hardened `docker-compose.yml`; Prometheus / OTel / Grafana configs.
- Infrastructure: Kubernetes manifests (`infrastructure/kubernetes/agentic-ai/`),
  Helm chart (`infrastructure/helm/agentic-ai/`), and Terraform module
  (`infrastructure/terraform/modules/agentic-ai/`).
- Tooling: `pyproject.toml` (ruff, mypy strict, pytest, coverage,
  bandit), split `requirements/`, `.pre-commit-config.yaml`.
- CI: `agentic-ai-ci.yml` (lint, typecheck, tests, security scans,
  image build + Trivy + SBOM) and `codeql-agentic-ai.yml`.
- Repo automation: Dependabot, CODEOWNERS.
- Tests: `test_errors`, `test_security_redaction`, `test_resilience`,
  `test_observability`, `test_cost`, `test_settings`, `test_middleware`,
  `test_health`.
- Docs: ADRs 0001–0004, incident-response runbook, security notes,
  `docs/HARDENING.md`.

### Changed
- `config/settings.py` rewritten: strict `Literal` enums, `SecretStr`
  credentials, production fail-fast validation, numeric bounds, new
  OTel / cost / GCP settings.
- `agents/base_agent.py`: new `invoke()` with resilience + observability.
- `core/pipeline.py`: per-stage spans + metrics, top-level deadline.
- `mcp_server/logging_config.py`: JSON, trace correlation, redaction.
- `mcp_server/validation.py`: routes through `security` sanitizers.

### Known follow-ups
- mypy strict baseline cleanup (CI runs `continue-on-error`).
- Distributed rate limiter for multi-replica HTTP deployments.
- ECS Fargate task definition (Terraform module currently provisions
  ECR + secrets + KMS + optional Helm release).

[Keep a Changelog]: https://keepachangelog.com/en/1.1.0/
