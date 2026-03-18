# Multi-stage Dockerfile for Agentic AI Pipeline + MCP server package

# Build stage
FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    && rm -rf /var/lib/apt/lists/*

# Build context is repository root
COPY agentic_ai/requirements.txt ./requirements.txt

RUN pip install --user --no-cache-dir -r requirements.txt

# Runtime stage
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /root/.local /root/.local

# Build context is repository root
COPY agentic_ai ./agentic_ai
COPY mcp_server ./mcp_server

RUN chmod +x agentic_ai/aws/deploy.sh agentic_ai/azure/deploy.sh

ENV PATH=/root/.local/bin:$PATH
ENV PYTHONPATH=/app:$PYTHONPATH

EXPOSE 8000 8001 9090

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "from mcp_server.runtime import ServerRuntime; import sys; sys.exit(0 if ServerRuntime().ready else 1)" || exit 1

CMD ["python", "-m", "mcp_server"]
