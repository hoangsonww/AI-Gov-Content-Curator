# Pipeline Map

## Core Files

- `agentic_ai/core/pipeline.py`
- `agentic_ai/agents/`
- `agentic_ai/config/settings.py`
- `agentic_ai/mcp_server/server.py`
- `agentic_ai/requirements.txt`
- `agentic_ai/Makefile`

## Local Run Paths

- `make run-mcp`
- `python -m agentic_ai.mcp_server.server`

## Known Fragility

- Make targets reference paths that may not exist
- cloud adapters look partly scaffolded
- docs and health checks drift from the current runtime
