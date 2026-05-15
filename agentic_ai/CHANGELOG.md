# Changelog — Agentic AI

All notable changes to `agentic_ai/` and `mcp_server/` are documented
here. Format loosely follows [Keep a Changelog]; versions track
`pyproject.toml`.

## [Unreleased]

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
