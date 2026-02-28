# Agentic AI Memory

This directory is a separate Python subsystem for multi-agent article processing and a local MCP server.

## What Matters

- Core pipeline: `core/pipeline.py`
- Agents: `agents/`
- Settings: `config/settings.py`
- MCP server: `mcp_server/server.py`
- Cloud adapters: `aws/` and `azure/`

## Guardrails

- Treat this area as partly scaffolded. Reconcile docs, Make targets, health checks, and runtime code before declaring anything production-ready.
- Use the MCP server files as the source of truth for Claude Code integration.
- Be careful with cloud deployment scripts. Several assumptions look incomplete or environment-specific.

## Useful Commands

- `make install`
- `make run-mcp`
- `python -m agentic_ai.mcp_server.server`
