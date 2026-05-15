# ADR 0002 — MCP Transport Choice

- **Status**: Accepted
- **Date**: 2026-05-14

## Context

The MCP server exposes the pipeline + ACP primitives to LLM clients
(Claude Code, Cursor, custom). MCP supports stdio, SSE, and HTTP/SSE
transports.

## Decision

Use **stdio** as the canonical transport. Reasons:

1. Stdio is the supported, stable transport in `mcp >= 1.2.0` and matches
   the configuration of every first-class client we target.
2. Authentication is delegated to the host process (Claude Code) — no
   need to design / harden HTTP auth.
3. The stdio model is single-process, so the in-process rate limiter and
   in-memory job store are sufficient.

HTTP / SSE remain available for future remote-multitenant scenarios, but
are not deployed today.

## Consequences

- All logs go to **stderr** so stdout remains a clean MCP channel.
- Liveness / readiness probes cannot use HTTP — they're exposed via the
  `check_pipeline_health` MCP tool and the `mcp-preflight` Make target.
- Horizontal scale-out requires switching to HTTP transport + Redis-backed
  job store. Tracked in ADR 0004.
