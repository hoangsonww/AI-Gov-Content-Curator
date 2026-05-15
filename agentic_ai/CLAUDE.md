# Agentic AI Memory

This directory is a separate Python subsystem for multi-agent article
processing. The MCP server package lives at `mcp_server/`.

## What Matters

- Core pipeline: `core/pipeline.py`
- Agents: `agents/`
- Settings: `config/settings.py` — strict pydantic-settings, SecretStr,
  prod fail-fast on missing provider keys.
- Cross-cutting primitives (live in `mcp_server/` and re-exported from
  `agentic_ai.core`):
  - `mcp_server/errors.py` — typed exceptions, retry classification.
  - `mcp_server/security.py` — secret redaction, sanitization,
    rate limiting, constant-time compare.
  - `mcp_server/observability.py` — OTel traces + Prometheus metrics.
  - `mcp_server/resilience.py` — retries + circuit breaker + timeout
    (`guarded_call`).
  - `mcp_server/health.py` — liveness / readiness / health.
  - `mcp_server/middleware.py` — `tool_middleware()` wrapper for every
    MCP tool.
  - `mcp_server/cost.py` — LLM cost estimation.
- MCP server package:
  - `mcp_server/app.py` (composition/bootstrapping)
  - `mcp_server/tools/` (tool registrations)
  - `mcp_server/resources/` (resource registrations)
  - `mcp_server/prompts/` (prompt registrations)
  - `mcp_server/runtime.py` + `job_store.py` (runtime state, retention)
- Cloud adapters: `aws/`, `azure/` (and now `gcp_*` settings).

## Guardrails

- The system is **production-hardened** (as of 2026-05-14). The previous
  "partly scaffolded" warning no longer applies for the modules listed
  above. Older surfaces (cloud adapter scripts, FastAPI `api.py`) still
  predate the hardening; treat them as candidates for follow-up.
- `mcp_server/` is the source of truth for Claude Code integration.
- Be careful with cloud deployment scripts — assumptions may still be
  out of date.

## Canonical Commands

- `make install-dev`
- `make check` (lint + types + security + tests)
- `make run-mcp`
- `make mcp-preflight`
- `make compose-up-monitoring` (full local stack with Prometheus + Grafana)
- `PYTHONPATH=.. python -m mcp_server`

## CI

`.github/workflows/agentic-ai-ci.yml` covers lint, typecheck, pytest
(py3.11 + py3.12 matrix, Redis service), bandit, pip-audit, gitleaks,
Trivy scan of the container image, and SBOM (Syft).

## Docs

- `docs/adr/0001-provider-strategy.md`
- `docs/adr/0002-mcp-transport.md`
- `docs/adr/0003-acp-backend.md`
- `docs/adr/0004-observability.md`
- `docs/runbook/incident-response.md`
- `docs/security.md`
