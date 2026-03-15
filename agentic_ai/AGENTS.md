# Agentic AI Guidance

- This is a separate Python subsystem with its own settings and dependency surface.
- Use `mcp_server/` (especially `app.py`, `tools.py`, `resources.py`, `prompts.py`, `runtime.py`), `config/settings.py`, and `core/pipeline.py` as the runtime source of truth.
- Reconcile README claims, Make targets, and cloud adapters before describing this area as fully operational.
- Only run local MCP or pipeline commands when the Python environment is known ready.
