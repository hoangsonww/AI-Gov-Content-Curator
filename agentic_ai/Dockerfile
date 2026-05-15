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

# Base image pinned by digest for reproducible, supply-chain-verifiable
# builds. Refresh the digest deliberately (it captures the latest Debian
# security patches): docker buildx imagetools inspect python:3.11-slim-bookworm
ARG PYTHON_IMAGE=python:3.11-slim-bookworm@sha256:cd67330292a51e2963156f74ff340455d66b2172e9190e99f40dff9357471177
ARG APP_USER=synthora
ARG APP_UID=10001
ARG APP_GID=10001
# INSTALL_PROFILE: "base" (default) or "all" (adds cloud-aws+azure+gcp).
ARG INSTALL_PROFILE=base

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
# Pin build tooling to CVE-patched versions (wheel CVE-2026-24049).
RUN python -m pip install --upgrade \
      "pip>=25.0" \
      "setuptools>=78.1.1" \
      "wheel>=0.46.2"

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

# Build tooling is not needed at runtime — remove it from the venv so it
# does not ship in the runtime image (smaller surface; drops the `wheel`
# package entirely). `pip` is kept for diagnostics; the runtime fs is
# read-only so it cannot be used to mutate the image.
RUN pip uninstall -y wheel 2>/dev/null || true \
 && find /opt/venv -name "__pycache__" -type d -prune -exec rm -rf {} + \
 && find /opt/venv -name "*.pyc" -delete

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

# Strip build tooling from BOTH the runtime venv and the base image's
# system site-packages. pip/setuptools/wheel are only needed to *install*
# packages; the runtime never does. Removing them eliminates their (and
# their vendored deps') CVEs — pip/setuptools vendor `wheel` and
# `jaraco.context` — and shrinks the image. The `dev` target re-copies
# the full venv from `dev-builder`, so dev tooling is unaffected.
RUN set -eux; \
    for sp in /opt/venv/lib/python*/site-packages /usr/local/lib/python*/site-packages; do \
        rm -rf "$sp"/pip "$sp"/pip-* "$sp"/pip/* \
               "$sp"/setuptools "$sp"/setuptools-* \
               "$sp"/_distutils_hack "$sp"/distutils-precedence.pth \
               "$sp"/wheel "$sp"/wheel-* \
               "$sp"/pkg_resources 2>/dev/null || true; \
    done; \
    rm -rf /usr/local/bin/pip /usr/local/bin/pip3 /usr/local/bin/pip3.* \
           /usr/local/bin/wheel /opt/venv/bin/pip /opt/venv/bin/pip3* 2>/dev/null || true; \
    find /opt/venv /usr/local/lib/python* -name "__pycache__" -type d -prune \
         -exec rm -rf {} + 2>/dev/null || true; \
    find /opt/venv -name "*.pyc" -delete 2>/dev/null || true

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
