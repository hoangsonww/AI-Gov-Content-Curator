# Pipeline Map

## Core Files

- `agentic_ai/core/pipeline.py`
- `agentic_ai/agents/`
- `agentic_ai/config/settings.py`
- `mcp_server/app.py`
- `mcp_server/tools/`
- `mcp_server/resources/`
- `mcp_server/prompts/`
- `mcp_server/runtime.py`
- `mcp_server/job_store.py`
- `mcp_server/server.py` (compatibility wrapper)
- `agentic_ai/requirements.txt`
- `agentic_ai/Makefile`

## Local Run Paths

- `make run-mcp`
- `python -m mcp_server`

## Known Fragility

- Make targets reference paths that may not exist
- cloud adapters look partly scaffolded
- docs and health checks drift from the current runtime
