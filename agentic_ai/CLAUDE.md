# Agentic AI Memory

This directory is a separate Python subsystem for multi-agent article processing. The MCP server package lives at `mcp_server/`.

## What Matters

- Core pipeline: `core/pipeline.py`
- Agents: `agents/`
- Settings: `config/settings.py`
- MCP server package:
- `mcp_server/app.py` (composition/bootstrapping)
- `mcp_server/tools/` (tool registrations)
- `mcp_server/resources/` (resource registrations)
- `mcp_server/prompts/` (prompt registrations)
- `mcp_server/runtime.py` + `job_store.py` (runtime state and retention)
- `mcp_server/server.py` (compatibility wrapper)
- Cloud adapters: `aws/` and `azure/`

## Guardrails

- Treat this area as partly scaffolded. Reconcile docs, Make targets, health checks, and runtime code before declaring anything production-ready.
- Use the `mcp_server/` files as the source of truth for Claude Code integration.
- Be careful with cloud deployment scripts. Several assumptions look incomplete or environment-specific.

## Useful Commands

- `make install`
- `make run-mcp`
- `make mcp-preflight`
- `PYTHONPATH=.. python -m mcp_server`
