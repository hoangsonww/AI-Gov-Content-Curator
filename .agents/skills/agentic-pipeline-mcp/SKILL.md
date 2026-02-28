---
name: agentic-pipeline-mcp
description: Change or review the Python agentic_ai subsystem or Codex-facing MCP integration for this repository. Use when work touches agentic_ai/, the LangGraph pipeline, the local MCP server, .mcp.json, or cloud adapters for the agentic pipeline.
---

# Agentic Pipeline MCP

Treat `agentic_ai/` as a separate Python project.

## Follow This Workflow

1. Read `mcp_server/server.py`, `config/settings.py`, and `core/pipeline.py` together.
2. Use the current MCP server implementation as the source of truth for tools and resources.
3. Reconcile README claims, Make targets, and health-check assumptions before changing runtime guidance.
4. Only run local MCP or pipeline commands when the Python environment is known ready.

## Use The References

- Read `references/pipeline-map.md` for runtime paths and known drift.
