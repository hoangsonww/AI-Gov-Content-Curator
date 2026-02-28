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

## MCP Notes

- the implemented local MCP server runs from Python, not a separate binary
- settings default the MCP server to port `8001`
- health-check and example assumptions in docs may not match the current code

## Known Fragility

- Make targets reference paths that may not exist
- cloud adapters appear partly scaffolded
- Docker and health-check assumptions drift from the local Python runtime
