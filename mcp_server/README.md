# MCP Server (`mcp_server`)

Implementation-first documentation for the SynthoraAI Model Context Protocol server package.

This package exposes the Agentic AI pipeline through MCP primitives (tools, resources, prompts) over **stdio transport** for local and hosted MCP clients.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Package Layout](#package-layout)
4. [MCP Primitive Catalog](#mcp-primitive-catalog)
5. [Runtime Model](#runtime-model)
6. [ACP Runtime Model](#acp-runtime-model)
7. [Configuration](#configuration)
8. [Run Locally](#run-locally)
9. [MCP Client Integration](#mcp-client-integration)
10. [Reliability & Observability](#reliability--observability)
11. [Operational Notes](#operational-notes)
12. [Testing](#testing)
13. [Migration Notes](#migration-notes)
14. [Troubleshooting](#troubleshooting)

## Overview

`mcp_server` is the MCP-facing boundary for the Python Agentic AI subsystem.

It does the following:

- Boots `FastMCP` with server identity from `agentic_ai.config.settings`.
- Configures structured logging + OpenTelemetry observability at startup.
- Initializes shared runtime state (`ServerRuntime`) with a compiled `AgenticPipeline` instance, an async-safe in-memory processing `job_store`, and the ACP store.
- Registers tools/resources/prompts from modular packages; every tool is wrapped by `tool_middleware` (span + metrics + typed-error envelope + rate limit).
- Emits JSON logs to **stderr** — with OTel `trace_id` correlation and secret redaction — to keep the MCP stdio JSON-RPC channel clean.

This package also hosts the cross-cutting hardening layer shared with the
agentic pipeline: `errors.py` (typed exceptions), `resilience.py` (retry
+ circuit breaker + timeout), `observability.py` (OTel + Prometheus),
`security.py` (redaction / sanitization / rate limiting), `health.py`,
`middleware.py`, and `cost.py`.

The server uses **stdio transport** and is launched on demand by an MCP
host/client — it is not a long-running daemon (see
[`../agentic_ai/docs/adr/0002-mcp-transport.md`](../agentic_ai/docs/adr/0002-mcp-transport.md)):

```bash
python -m mcp_server
```

## Architecture

```mermaid
flowchart LR
    Client[MCP Host / Client] -->|JSON-RPC over stdio| FastMCP[FastMCP Server]
    FastMCP --> MW[tool_middleware<br/>span + metrics + errors + rate limit]
    MW --> Tools[tools/*]
    FastMCP --> Resources[resources/*]
    FastMCP --> Prompts[prompts/*]

    Tools --> Runtime[ServerRuntime]
    Resources --> Runtime

    Runtime --> Pipeline[AgenticPipeline]
    Runtime --> JobStore[ProcessingJobStore]
    Runtime --> ACPStore[ACP Store: Redis or Memory]

    Pipeline --> Agents[Analyzer / Summarizer / Classifier / Sentiment / Quality]

    Tools -.observability.-> OTel[OTel spans + Prometheus]
    Pipeline -.observability.-> OTel
    Tools -.resilience.-> Guard[retry + circuit breaker + timeout]
```

## Package Layout

```text
mcp_server/
  __main__.py                # module entrypoint (python -m mcp_server)
  app.py                     # composition root; configures logging + observability
  server.py                  # compatibility wrapper exports
  runtime.py                 # runtime container (pipeline + job store + ACP)
  job_store.py               # async-safe in-memory processing jobs
  diagnostics.py             # health/capabilities/provider/limits snapshots
  catalog.py                 # canonical tool/resource/prompt inventories
  models.py                  # pydantic request/status models
  validation.py              # payload + metadata guardrails (routes through security)
  text_metrics.py            # content diagnostics/readability metrics
  logging_config.py          # stderr JSON logging + OTel trace correlation + redaction
  ruff.toml                  # shares lint/format config with agentic_ai/pyproject.toml
  # ── cross-cutting hardening layer (shared with the agentic pipeline) ──
  errors.py                  # typed exception hierarchy + retryable classification
  resilience.py              # retry (tenacity) + in-process circuit breaker + timeout
  observability.py           # OpenTelemetry tracing + Prometheus metric registry
  security.py                # secret redaction, sanitization, rate limiter
  health.py                  # liveness / readiness / deep-health
  middleware.py              # tool_middleware — wraps every MCP tool
  cost.py                    # per-model LLM cost estimation
  tools/
    processing.py            # process + lifecycle + job controls
    analysis.py              # analysis/summarization/classification tools
    operations.py            # readiness/capabilities/preflight tools
    acp.py                   # ACP register/heartbeat/send/inbox/ack tools
    common.py                # shared tool helpers (validation, parsing)
  resources/
    config.py                # config://* resources
    runtime.py               # runtime://* resources
    jobs.py                  # jobs://* and topics://* resources
    acp.py                   # acp://* resources
  prompts/
    summarization.py         # summarize/executive prompts
    analysis.py              # sentiment/classification/quality prompts
    governance.py            # bias and incident prompts
```

## MCP Primitive Catalog

Source of truth is `mcp_server/catalog.py`.

### Tools

#### Processing lifecycle tools

- `process_article`
- `process_article_batch`
- `validate_article_payload`
- `get_processing_status`
- `get_processing_result`
- `list_processing_jobs`
- `delete_processing_job`
- `purge_processing_jobs`

#### Analysis tools

- `analyze_content`
- `analyze_sentiment`
- `extract_topics`
- `evaluate_quality`
- `compute_text_metrics`
- `generate_summary`

#### Operations/diagnostics tools

- `check_pipeline_health`
- `get_pipeline_graph`
- `get_runtime_readiness`
- `get_server_capabilities`
- `diagnose_provider_configuration`
- `run_preflight_checks`

#### ACP tools

- `acp_register_agent`
- `acp_unregister_agent`
- `acp_heartbeat`
- `acp_send_message`
- `acp_fetch_inbox`
- `acp_acknowledge_message`
- `acp_list_agents`
- `acp_get_message`

### Resources

- `config://pipeline`
- `config://limits`
- `config://providers`
- `config://features`
- `runtime://health`
- `runtime://readiness`
- `runtime://capabilities`
- `runtime://pipeline/graph`
- `jobs://stats`
- `jobs://recent`
- `topics://available`
- `acp://agents`
- `acp://stats`
- `acp://messages/recent`

### Prompts

- `summarize_article_prompt`
- `executive_brief_prompt`
- `analyze_sentiment_prompt`
- `classify_article_prompt`
- `quality_audit_prompt`
- `red_team_bias_prompt`
- `incident_triage_prompt`

## Runtime Model

`ServerRuntime` (`runtime.py`) initializes three shared objects:

- `pipeline`: an `AgenticPipeline` instance, marked unavailable if startup fails.
- `jobs`: a `ProcessingJobStore` with bounded history and TTL.
- `acp`: ACP store selected by `ACP_BACKEND` (`redis` in production, `memory` fallback outside strict mode).

### Job store behavior

The in-memory store provides:

- Async lock protection for concurrent tool calls.
- Ordered recency listing with filters and pagination.
- TTL pruning for completed jobs.
- Max-history enforcement.
- Bulk purge by status and/or age.

Guardrails are controlled by settings:

- `mcp_max_job_history`
- `mcp_job_ttl_seconds`

## ACP Runtime Model

```mermaid
flowchart LR
    Start[ServerRuntime boot] --> ACPEnabled{ACP_ENABLED?}
    ACPEnabled -->|No| ACPDisabled[ACP checks report disabled]
    ACPEnabled -->|Yes| Backend{ACP_BACKEND}
    Backend -->|redis| RedisInit[Init RedisACPStore]
    Backend -->|memory| MemInit[Init InMemoryACPStore]
    RedisInit --> StrictProd{ENVIRONMENT=production?}
    StrictProd -->|Yes + Redis unavailable| FailFast[RuntimeError fail-fast]
    StrictProd -->|No / available| ACPReady[ACP ready]
    MemInit --> ACPReady
```

ACP operational preflight (`acp_preflight`) performs:
- Optional Redis ping (when Redis backend selected)
- Agent registration roundtrip
- Message send -> inbox fetch -> acknowledgment
- Cleanup/unregister

## Configuration

All config is loaded from `agentic_ai/config/settings.py` (`.env` support via `agentic_ai/.env` and `.env`).

### Key MCP settings

- `MCP_SERVER_NAME` (default `synthora-agentic-pipeline`)
- `MCP_SERVER_VERSION` (default `1.0.0`)
- `MCP_MAX_CONTENT_CHARS` (default `20000`)
- `MCP_MAX_METADATA_ENTRIES` (default `50`)
- `MCP_MAX_METADATA_VALUE_CHARS` (default `2000`)
- `MCP_MAX_BATCH_ITEMS` (default `25`)
- `MCP_MAX_JOB_HISTORY` (default `1000`)
- `MCP_JOB_TTL_SECONDS` (default `86400`)
- `ACP_ENABLED` (default `true`)
- `ACP_BACKEND` (default `redis`, options: `redis`, `memory`)
- `ACP_REDIS_KEY_PREFIX` (default `synthora:acp`)
- `ACP_MAX_AGENTS` (default `200`)
- `ACP_MAX_MESSAGES` (default `5000`)
- `ACP_MESSAGE_TTL_SECONDS` (default `3600`)
- `ACP_AGENT_TTL_SECONDS` (default `900`)
- `ACP_MAX_PAYLOAD_CHARS` (default `20000`)
- `ACP_MAX_METADATA_ENTRIES` (default `50`)
- `ACP_MAX_CAPABILITIES` (default `32`)

When `ENVIRONMENT=production` and `ACP_ENABLED=true`, setting `ACP_BACKEND=redis` is strict:
if Redis dependencies/backend are unavailable at startup, runtime initialization fails fast.

### Provider readiness

The runtime can operate in degraded mode if providers are misconfigured; inspect with:

- Tool: `diagnose_provider_configuration`
- Tool: `run_preflight_checks`
- Resource: `config://providers`
- Resource: `runtime://readiness`

## Run Locally

### Prerequisites

- Python 3.11+
- Dependencies installed from `agentic_ai/requirements.txt`
- At least one configured model provider for full runtime readiness

### Install

From repository root:

```bash
pip install -r agentic_ai/requirements.txt
```

### Start server

From repository root:

```bash
PYTHONPATH=. python -m mcp_server
```

Or from `agentic_ai/`:

```bash
PYTHONPATH=.. python -m mcp_server
```

### Preflight check

```bash
cd agentic_ai
make mcp-preflight
```

## MCP Client Integration

### Repository `.mcp.json` usage

This repository already configures the server in `.mcp.json`:

```json
{
  "mcpServers": {
    "synthora-agentic-pipeline": {
      "command": "python",
      "args": ["-m", "mcp_server"],
      "env": {
        "PYTHONPATH": ".",
        "PYTHONUNBUFFERED": "1"
      }
    }
  }
}
```

### Minimal Python stdio client example

```python
import asyncio
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def main() -> None:
    server = StdioServerParameters(
        command="python",
        args=["-m", "mcp_server"],
        env={"PYTHONPATH": "."},
    )

    async with stdio_client(server) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            capabilities = await session.call_tool("get_server_capabilities", {})
            print(capabilities)

            result = await session.call_tool(
                "process_article",
                {
                    "article_id": "example-1",
                    "content": "Policy article content goes here.",
                    "url": "https://example.com/article",
                    "source": "government",
                    "metadata": {"department": "transport"},
                },
            )
            print(result)


asyncio.run(main())
```

## Reliability & Observability

Every MCP tool is wrapped by `tool_middleware` (`middleware.py`), which
provides, uniformly and without per-tool boilerplate:

- an OpenTelemetry span (`mcp.tool.<name>`),
- Prometheus metrics (`synthora_mcp_tool_invocations_total`,
  `synthora_mcp_tool_duration_seconds`),
- conversion of any `MCPError` subclass into a typed error envelope
  (`{error, message, context, retryable}`) — callers never see a raw
  traceback,
- optional per-caller token-bucket rate limiting.

External calls (LLM providers via the pipeline, Redis) flow through
`resilience.guarded_call`: exponential-backoff retry on classified
*transient* errors, a per-provider circuit breaker, and a timeout.

`observability.py` exposes a typed Prometheus registry; `metrics_text()`
renders it for the FastAPI `/metrics` endpoint. Logs (`logging_config.py`)
are JSON on stderr, carry `trace_id`/`span_id`, and are secret-redacted.

Health is three-tiered in `health.py`: liveness, readiness (ACP/Redis
preflight), and a deep-health snapshot.

## Operational Notes

- Transport is stdio in `app.py` (`self.mcp.run(transport="stdio")`).
- The MCP server is launched **on demand** by an MCP client; it is not a
  daemon and exits cleanly on stdin EOF — do not run it as a long-lived
  Deployment.
- Logging is intentionally stderr-only (`logging_config.py`) to avoid corrupting JSON-RPC streams.
- `app.py` calls `configure_observability()` at boot; tracing degrades
  to a no-op if no OTLP endpoint is configured.
- `generate_summary` returns a **string** response; most other tools return object payloads.
- `process_article_batch` supports fail-fast via `continue_on_error=False`.
- `purge_processing_jobs` requires explicit confirmation when purging everything (`confirm=true`).

## Testing

Tests live in `agentic_ai/tests/` (77 total — unit, MCP integration,
end-to-end pipeline). They cover this package's job store, validation,
ACP store + Redis backend, errors, security/redaction, resilience,
observability, middleware, health, cost, and a full `test_mcp_integration.py`
that boots the real server and exercises tool registration + invocation.

From repository root:

```bash
PYTHONPATH=. pytest -q agentic_ai/tests/
# or, from agentic_ai/:
make test
```

Optional compile check:

```bash
python -m py_compile $(find mcp_server -name '*.py')
```

Static analysis (`mcp_server/ruff.toml` shares config with
`agentic_ai/pyproject.toml`):

```bash
cd agentic_ai && make lint typecheck security
```

## Migration Notes

- Package path is now `mcp_server`.
- Legacy `standalone_mcp_server` references were removed.
- Compatibility alias retained in code: `StandaloneAgenticMCPServer = AgenticMCPServer`.

Use `python -m mcp_server` as the canonical entrypoint.

## Troubleshooting

### Runtime shows degraded / not ready

- Run `make mcp-preflight` from `agentic_ai/`.
- Call `get_runtime_readiness` and `diagnose_provider_configuration`.
- Verify required provider keys are set in `.env`.

### MCP client fails to connect

- Confirm client launches with `python -m mcp_server`.
- Confirm `PYTHONPATH` includes repo root.
- Ensure no stdout logging is introduced in server code.

### Empty `topics://available`

- This indicates pipeline runtime is unavailable.
- Fix readiness first, then retry resource call.
