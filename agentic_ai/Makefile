SHELL := /usr/bin/env bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

PYTHON ?= python3.11
VENV ?= .venv
PIP := $(VENV)/bin/pip
PYTHONPATH_ROOT := $(shell cd .. && pwd)

REQ_BASE := requirements/base.txt
REQ_DEV := requirements/dev.txt

DOCKER_IMAGE ?= synthora/mcp
DOCKER_TAG ?= local
DOCKER_TARGET ?= mcp
DOCKER_PLATFORM ?= linux/amd64

.PHONY: help
help: ## Show this help
	@awk 'BEGIN{FS=":.*?## "} /^[a-zA-Z_-]+:.*?## /{printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ── Environment ────────────────────────────────────────────────────────────

.PHONY: venv
venv: ## Create virtualenv if missing
	@if [ ! -d "$(VENV)" ]; then $(PYTHON) -m venv $(VENV); fi
	@$(PIP) install --upgrade pip wheel setuptools

.PHONY: install
install: venv ## Install base runtime deps
	$(PIP) install -r $(REQ_BASE)

.PHONY: install-dev
install-dev: venv ## Install dev + base deps
	$(PIP) install -r $(REQ_DEV)

.PHONY: install-all
install-all: venv ## Install all cloud providers + dev
	$(PIP) install -r requirements/all.txt

.PHONY: lock
lock: venv ## Regenerate fully-pinned lockfile with hashes
	$(PIP) install pip-tools
	$(VENV)/bin/pip-compile --generate-hashes \
		--resolver=backtracking \
		--output-file requirements.lock.txt \
		requirements/base.txt

# ── Quality ───────────────────────────────────────────────────────────────

.PHONY: format
format: ## Ruff format + autofix
	$(VENV)/bin/ruff format .
	$(VENV)/bin/ruff check --fix . ../mcp_server

.PHONY: lint
lint: ## Run ruff lint
	$(VENV)/bin/ruff check . ../mcp_server
	$(VENV)/bin/ruff format --check . ../mcp_server

.PHONY: typecheck
typecheck: ## Run mypy strict
	cd $(PYTHONPATH_ROOT) && $(CURDIR)/$(VENV)/bin/mypy \
		--config-file=$(CURDIR)/pyproject.toml mcp_server agentic_ai

.PHONY: security
security: ## Run bandit + pip-audit
	$(VENV)/bin/bandit -c pyproject.toml -r . ../mcp_server -ll
	$(VENV)/bin/pip-audit -r requirements/base.txt --strict

.PHONY: precommit
precommit: ## Run all pre-commit hooks
	$(VENV)/bin/pre-commit run --all-files

.PHONY: check
check: lint typecheck security test ## Run lint + types + security + tests

# ── Tests ─────────────────────────────────────────────────────────────────

.PHONY: test
test: ## Run unit tests
	PYTHONPATH=$(PYTHONPATH_ROOT) $(VENV)/bin/pytest -q

.PHONY: test-cov
test-cov: ## Run tests with HTML coverage
	PYTHONPATH=$(PYTHONPATH_ROOT) $(VENV)/bin/pytest --cov-report=html

.PHONY: test-watch
test-watch: ## Run tests in watch mode
	PYTHONPATH=$(PYTHONPATH_ROOT) $(VENV)/bin/pytest --looponfail

# ── Run ───────────────────────────────────────────────────────────────────

.PHONY: run-mcp
run-mcp: ## Run the MCP server locally over stdio
	PYTHONPATH=$(PYTHONPATH_ROOT) $(VENV)/bin/python -m mcp_server

.PHONY: mcp-preflight
mcp-preflight: ## Liveness + ACP preflight as JSON
	PYTHONPATH=$(PYTHONPATH_ROOT) $(VENV)/bin/python -c "import asyncio, json; \
from mcp_server.runtime import ServerRuntime; \
rt=ServerRuntime(); \
acp=asyncio.run(rt.acp_preflight()); \
report={'runtime': rt.readiness(), 'acp': acp, 'ready': rt.readiness()['ready'] and acp['ready']}; \
print(json.dumps(report, indent=2)); \
raise SystemExit(0 if report['ready'] else 1)"

# ── Docker ────────────────────────────────────────────────────────────────

.PHONY: docker-build
docker-build: ## Build the runtime image
	docker build \
		--platform $(DOCKER_PLATFORM) \
		-f Dockerfile \
		--target $(DOCKER_TARGET) \
		-t $(DOCKER_IMAGE):$(DOCKER_TAG) \
		..

.PHONY: docker-buildx
docker-buildx: ## Multi-arch build via buildx
	docker buildx build \
		--platform linux/amd64,linux/arm64 \
		-f Dockerfile \
		--target $(DOCKER_TARGET) \
		-t $(DOCKER_IMAGE):$(DOCKER_TAG) \
		..

.PHONY: docker-scan
docker-scan: docker-build ## Trivy scan local image
	trivy image --severity HIGH,CRITICAL $(DOCKER_IMAGE):$(DOCKER_TAG)

.PHONY: sbom
sbom: docker-build ## Generate SPDX SBOM for the local image
	syft $(DOCKER_IMAGE):$(DOCKER_TAG) -o spdx-json > sbom.spdx.json

.PHONY: compose-up
compose-up: ## Start local stack (mcp + redis)
	docker compose -f docker-compose.yml --env-file .env up -d

.PHONY: compose-up-monitoring
compose-up-monitoring: ## Start local stack with Prometheus + Grafana + OTel
	docker compose -f docker-compose.yml --env-file .env --profile monitoring up -d

.PHONY: compose-down
compose-down: ## Stop local stack
	docker compose -f docker-compose.yml down

# ── Misc ──────────────────────────────────────────────────────────────────

.PHONY: clean
clean: ## Remove caches and build artifacts
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf build/ dist/ .pytest_cache/ .ruff_cache/ .mypy_cache/ .coverage coverage.xml htmlcov/ *.egg-info

.PHONY: setup-env
setup-env: ## Copy .env.example → .env (if missing)
	@if [ ! -f .env ]; then cp .env.example .env && echo "Created .env"; else echo ".env already exists"; fi

.PHONY: visualize
visualize: ## Print pipeline mermaid graph
	PYTHONPATH=$(PYTHONPATH_ROOT) $(VENV)/bin/python -c \
		"from agentic_ai.core.pipeline import AgenticPipeline; print(AgenticPipeline().visualize())"
