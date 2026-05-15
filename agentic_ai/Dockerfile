# syntax=docker/dockerfile:1.7
#
# Multi-stage, multi-target Dockerfile for the SynthoraAI Agentic AI
# pipeline and its MCP server.
#
# Targets:
#   - base       (intermediate; not for runtime use)
#   - runtime    (production runtime — minimal, non-root)
#   - mcp        (MCP server entrypoint; default `CMD`)
#   - api        (FastAPI HTTP entrypoint)
#   - dev        (adds dev/test deps + tools for local development)
#
# Build (from repository root):
#   docker build -f agentic_ai/Dockerfile --target mcp -t synthora/mcp:latest .
#   docker build -f agentic_ai/Dockerfile --target api -t synthora/api:latest .
#
# Multi-arch:
#   docker buildx build --platform linux/amd64,linux/arm64 \
#       -f agentic_ai/Dockerfile --target mcp -t synthora/mcp:latest .

ARG PYTHON_IMAGE=python:3.11-slim-bookworm
ARG APP_USER=synthora
ARG APP_UID=10001
ARG APP_GID=10001
ARG INSTALL_PROFILE=base   # base | all   (cloud-aws+azure+gcp = all)

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — builder. Compile wheels and install into an isolated prefix.
# ─────────────────────────────────────────────────────────────────────────────
FROM ${PYTHON_IMAGE} AS builder

ARG INSTALL_PROFILE

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_ROOT_USER_ACTION=ignore

WORKDIR /build

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential \
      ca-certificates \
      curl \
      git \
 && rm -rf /var/lib/apt/lists/*

# Copy requirement manifests first to maximize layer caching.
COPY agentic_ai/requirements/ ./requirements/
COPY agentic_ai/pyproject.toml ./pyproject.toml

# Install into /opt/venv for a clean, copyable runtime tree.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"
RUN python -m pip install --upgrade pip setuptools wheel

# Resolve profile → requirements file.
RUN if [ "${INSTALL_PROFILE}" = "all" ]; then \
        echo "Installing cloud-aws + cloud-azure + cloud-gcp + base"; \
        pip install -r requirements/cloud-aws.txt \
                    -r requirements/cloud-azure.txt \
                    -r requirements/cloud-gcp.txt ; \
    else \
        echo "Installing base only"; \
        pip install -r requirements/base.txt ; \
    fi

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — runtime base. Minimal OS, non-root user, venv copied in.
# ─────────────────────────────────────────────────────────────────────────────
FROM ${PYTHON_IMAGE} AS runtime

ARG APP_USER
ARG APP_UID
ARG APP_GID

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PATH="/opt/venv/bin:${PATH}" \
    PYTHONPATH="/app" \
    PROMETHEUS_DISABLE_CREATED_SERIES=true

# Minimal runtime packages. curl kept for health probes inside the container.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      tini \
 && rm -rf /var/lib/apt/lists/*

# Non-root user. We do NOT chown the venv (read-only after build).
RUN groupadd --system --gid ${APP_GID} ${APP_USER} \
 && useradd --system --uid ${APP_UID} --gid ${APP_GID} \
        --home-dir /app --shell /usr/sbin/nologin ${APP_USER}

# Copy compiled venv from builder.
COPY --from=builder /opt/venv /opt/venv

# Application code. Owned by the non-root user.
WORKDIR /app
COPY --chown=${APP_UID}:${APP_GID} agentic_ai/ ./agentic_ai/
COPY --chown=${APP_UID}:${APP_GID} mcp_server/ ./mcp_server/

# Drop privileges and run via tini so signals are forwarded correctly.
USER ${APP_USER}

ENTRYPOINT ["/usr/bin/tini", "--"]

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — MCP server target. stdio transport. Default `CMD`.
# ─────────────────────────────────────────────────────────────────────────────
FROM runtime AS mcp

# Liveness: process up + module importable. Readiness is exposed via the
# MCP `check_pipeline_health` tool, not via HTTP, because transport is stdio.
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD python -c "import importlib; importlib.import_module('mcp_server'); print('ok')" || exit 1

CMD ["python", "-m", "mcp_server"]

# ─────────────────────────────────────────────────────────────────────────────
# Stage 4 — FastAPI HTTP target (optional alternate entrypoint).
# ─────────────────────────────────────────────────────────────────────────────
FROM runtime AS api

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl --fail --silent --show-error http://127.0.0.1:8000/healthz || exit 1

CMD ["python", "-m", "uvicorn", "agentic_ai.api:app", \
     "--host", "0.0.0.0", "--port", "8000", \
     "--proxy-headers", "--forwarded-allow-ips=*"]

# ─────────────────────────────────────────────────────────────────────────────
# Stage 5 — dev target. Includes test runners and tools.
# ─────────────────────────────────────────────────────────────────────────────
FROM builder AS dev-builder
RUN pip install -r requirements/dev.txt

FROM runtime AS dev
COPY --from=dev-builder /opt/venv /opt/venv
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
      git \
      make \
      vim-tiny \
 && rm -rf /var/lib/apt/lists/*
USER ${APP_USER}
CMD ["python", "-m", "mcp_server"]
