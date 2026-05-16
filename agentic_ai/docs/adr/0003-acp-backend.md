# ADR 0003 — ACP Backend (Redis vs Memory)

- **Status**: Accepted
- **Date**: 2026-05-14

## Context

The Agent Communication Protocol (ACP) routes messages between agents,
tracks registration, and stores per-agent inboxes. We need durability
across restarts in production, but zero external deps for local dev and
unit tests.

## Decision

Two backends, configurable via `ACP_BACKEND`:

| Backend  | Use case                            | Persistence | TTL handling |
| -------- | ----------------------------------- | ----------- | ------------ |
| `memory` | unit tests, local dev               | none        | best-effort  |
| `redis`  | production, integration tests       | yes         | Redis TTL    |

In `production`, if `ACP_BACKEND=redis` but Redis is unreachable, the
runtime raises rather than silently falling back to memory. This avoids
the silent-degradation antipattern.

## Consequences

- Redis is a required external dep in production.
- Memory backend tests cover happy paths; integration tests using a real
  Redis cover persistence + TTL.
