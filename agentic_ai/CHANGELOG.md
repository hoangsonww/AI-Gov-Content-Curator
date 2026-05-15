# Changelog — Agentic AI

All notable changes to `agentic_ai/` and `mcp_server/` are documented
here. Format loosely follows [Keep a Changelog]; versions track
`pyproject.toml`.

## [Unreleased]

### Fixed (fifth pass — pipeline correctness + image hardening)
- **Pipeline exponential blowup (severe)**: `AgentState.messages` and
  `.errors` were declared `Annotated[list, operator.add]` reducer
  channels, but every node mutates the shared list in place and returns
  the *whole* accumulated state. LangGraph applied the reducer as
  `channel = old + returned`, doubling both lists on every super-step.
  A low-quality article (which loops the quality gate) wedged the
  pipeline within a few iterations — per-stage time grew 8→16s and the
  run never finished. Changed both to plain `LastValue` channels (the
  graph is a strictly linear assembly line, so LastValue is correct).
  Low-quality run time: 90s+ timeout → 0.02s.
- **Quality-retry loop hit LangGraph's recursion limit**: each retry
  costs 5 graph steps and the default `recursion_limit` is 25, so a
  low-quality article raised `GraphRecursionError` long before reaching
  `max_iterations`. `process_article` now passes an explicit
  `recursion_limit` sized to `max_iterations * 6 + 15`.
- **CRITICAL CVE — langchain-core RCE (CVE-2025-68664)**: dependency
  lower bounds raised to CVE-patched releases — `langchain-core>=0.3.85`
  (was 0.3.63), `langchain>=0.3.30`, `langchain-community>=0.3.27`,
  added explicit `langchain-text-splitters>=0.3.9` (XXE). Trivy: Python
  HIGH/CRITICAL findings 35 → 3.
- **Build tooling stripped from the runtime image**: `pip`, `setuptools`,
  `wheel` (and the `wheel` / `jaraco.context` copies they vendor) are
  removed from both the venv and the base image's system site-packages
  in the runtime stage — the runtime never installs packages. Verified
  the app imports + boots without them. Eliminated their CVEs.
- **Base image pinned by digest** for reproducible, supply-chain-checked
  builds.
- **`google-generativeai` import FutureWarning** broke the test suite
  under `filterwarnings = error` whenever the package emitted its
  deprecation warning (seen in the container, not locally). Added a
  scoped `(?s)`-flagged message filter.

### Changed (fifth pass)
- Vector stores (`chromadb`, `faiss-cpu`, `pinecone-client`) moved out
  of the base dependency set into an opt-in `vectorstores` extra —
  nothing in the pipeline or MCP server imports them, and `chromadb`
  alone pulls onnxruntime (~200MB). Also dropped the unused `pandas`
  direct dependency. Runtime image: 850MB → 586MB.
- Added `.trivyignore` recording the 3 residual HIGH CVEs (langchain
  1.x-only fixes) with per-CVE non-exploitability rationale.
- `docs/security.md`: new CVE-posture section.

### Added (fifth pass)
- `tests/test_pipeline.py` — end-to-end pipeline tests with stubbed
  agents: happy path, low-quality retry loop termination, per-stage
  failure capture, metrics emission, graph visualization.
  `core/pipeline.py` coverage 34% → 92%; overall 39% → 55%.

### Verified (fifth pass)
- Built `mcp` / `api` / `dev` targets; ran the full suite (77 passing)
  inside the `dev` image and locally.
- Trivy scan of the image: 0 Python CRITICAL, 3 documented HIGH
  residuals; OS CVEs have no upstream fix (mitigated by container
  hardening).
- Booted the API container + compose stack; health, `/metrics`, ACP
  Redis backend all confirmed.

### Fixed (fourth pass — Docker build + runtime verification)
- **Dockerfile**: an inline comment on the `ARG INSTALL_PROFILE` line
  caused `dockerfile parse error: ARG names can not be blank`. The image
  could not build at all. Comment moved to its own line.
- **`.dockerignore` was never applied**: the build context is the repo
  root, so BuildKit looked for `<context>/.dockerignore`, not
  `agentic_ai/.dockerignore`. Renamed to `agentic_ai/Dockerfile.dockerignore`
  (BuildKit honours `<dockerfile>.dockerignore`).
- **Circuit breaker was broken on asyncio**: `pybreaker.call_async` is
  Tornado-based (`@gen.coroutine`) and raised `NameError: name 'gen' is
  not defined` whenever the breaker was exercised with `pybreaker`
  installed (i.e. in CI / the built image). Replaced with a
  self-contained `CircuitBreaker` in `mcp_server/resilience.py` —
  identical sync + async behaviour, no third-party dependency,
  CLOSED/OPEN/HALF_OPEN with reset timeout. `pybreaker` removed from
  dependencies. Coverage of `resilience.py` rose substantially (the
  breaker path is now actually testable).
- **docker-compose**: `deploy.resources.*.memory` used Kubernetes-style
  `Gi`/`Mi` suffixes, which Compose rejects (`invalid suffix`). Changed
  to Compose units (`2g`, `512m`, ...).
- **docker-compose**: `${VAR:?}` on profiled services (mongodb, grafana)
  broke `docker compose up` for the core services, because Compose
  interpolates every service eagerly regardless of active profile.
  Profiled services now use `:-` local-dev defaults.
- **MCP server is no longer deployed as a daemon**: an MCP stdio server
  exits cleanly on stdin EOF, so running it as a long-lived container
  (compose service / k8s Deployment) produced a restart/crash loop. The
  k8s `agentic-ai-mcp` Deployment and the Helm `mcp` sub-deployment were
  removed; the compose `mcp` service moved behind an `mcp` profile and
  is run on demand (`docker compose --profile mcp run --rm mcp`). The
  MCP server is launched on demand by an MCP client — the shared image
  still ships `python -m mcp_server`. Only the FastAPI `api` is a
  deployed workload.
- **`mcp_server/` had no ruff config**: running ruff with a working
  directory other than `agentic_ai/` fell back to ruff defaults for
  `mcp_server/`. Added `mcp_server/ruff.toml` that extends
  `agentic_ai/pyproject.toml`.

### Verified (fourth pass)
- Built the `mcp`, `api`, and `dev` image targets; ran the full test
  suite (72 passing) inside the `dev` image.
- Booted the MCP server and the FastAPI service in containers — health
  endpoints, `/metrics`, structured logs, and graceful degradation all
  confirmed.
- Brought up the compose stack (`api` + `redis`); verified the ACP
  Redis backend end-to-end (`redis_ping`, inbox round-trip, ack) and the
  on-demand `mcp` profile.

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
