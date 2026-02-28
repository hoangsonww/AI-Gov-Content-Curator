---
name: agentic-pipeline-mcp
description: Use this skill when working on the Python agentic_ai subsystem or Claude Code MCP integration for this repository, including the LangGraph pipeline, local MCP server, cloud adapters, and the project .mcp.json configuration.
---

# Agentic Pipeline MCP

This skill covers `agentic_ai/` and the repo-local Claude Code MCP setup.

## Working Rules

- Treat `agentic_ai/` as a separate Python project with its own settings and operational assumptions.
- Use the current MCP server implementation as the source of truth for available tools, resources, and prompts.
- Reconcile README claims, Make targets, health checks, and runtime code before saying the subsystem is ready.
- If you wire Claude Code MCP integration, prefer the local Python module entrypoint over hand-wavy docs.

## Validation

- Check `agentic_ai/mcp_server/server.py`, `agentic_ai/config/settings.py`, and `agentic_ai/requirements.txt` together.
- Confirm whether a requested change belongs in the pipeline, the MCP wrapper, or the deployment adapters.

## References

- For runtime and config details, read `references/pipeline-map.md`.
