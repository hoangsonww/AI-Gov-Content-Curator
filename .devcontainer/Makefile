# Makefile for ai-article-content-curator monorepo (now inside shell/)
# Usage: make <target>
# NOTE: Recipes must be indented with tabs (not spaces).

SHELL := /usr/bin/env bash

# Directories are now one level up from shell/
FRONTEND_DIR   := ../frontend
BACKEND_DIR    := ../backend
CRAWLER_DIR    := ../crawler
NEWSLETTER_DIR := ../newsletters

.PHONY: help bootstrap deps clean clean-build \
        dev-frontend build-frontend start-frontend test-frontend lint-frontend typecheck-frontend docker-frontend \
        dev-backend build-backend start-backend test-backend lint-backend typecheck-backend docker-backend \
        dev-crawler build-crawler start-crawler test-crawler lint-crawler typecheck-crawler docker-crawler \
        dev-newsletter build-newsletter start-newsletter newsletter send-newsletter lint-newsletter typecheck-newsletter \
        dev build start test lint typecheck docker reboot docker-compute

help:
	@echo ""
	@echo "Available targets:"
	@echo "  bootstrap            Install all dependencies"
	@echo "  deps                 Install dependencies in each workspace"
	@echo "  clean                Remove all node_modules and build dirs"
	@echo "  clean-build          Remove only build/output directories"
	@echo ""
	@echo "  dev-<svc>            Run <svc> in development mode (frontend/backend/crawler/newsletter)"
	@echo "  build-<svc>          Build <svc> for production"
	@echo "  start-<svc>          Start <svc> in production mode"
	@echo "  test-<svc>           Run tests for <svc>"
	@echo "  lint-<svc>           Run linter in <svc>"
	@echo "  typecheck-<svc>      Run TypeScript type checks in <svc>"
	@echo "  docker-<svc>         Build and run <svc> in Docker"
	@echo ""
	@echo "  dev                  Start all services in parallel"
	@echo "  build                Build all services sequentially"
	@echo "  start                Start all services sequentially"
	@echo "  test                 Run tests for all services"
	@echo "  lint                 Lint all services + root"
	@echo "  typecheck            Typecheck all services"
	@echo "  docker               Build and run all services via Docker"
	@echo "  reboot               Clean + bootstrap + dev"
	@echo ""

bootstrap:
	npm install
	$(MAKE) deps

deps:
	cd $(FRONTEND_DIR)   && npm install
	cd $(BACKEND_DIR)    && npm install
	cd $(CRAWLER_DIR)    && npm install
	cd $(NEWSLETTER_DIR) && npm install

clean:
	rm -rf node_modules
	rm -rf $(FRONTEND_DIR)/node_modules $(FRONTEND_DIR)/.next $(FRONTEND_DIR)/dist
	rm -rf $(BACKEND_DIR)/node_modules $(BACKEND_DIR)/dist
	rm -rf $(CRAWLER_DIR)/node_modules $(CRAWLER_DIR)/dist
	rm -rf $(NEWSLETTER_DIR)/node_modules $(NEWSLETTER_DIR)/.next

clean-build:
	rm -rf $(FRONTEND_DIR)/.next $(FRONTEND_DIR)/dist
	rm -rf $(BACKEND_DIR)/dist
	rm -rf $(CRAWLER_DIR)/dist
	rm -rf $(NEWSLETTER_DIR)/.next

## Frontend targets
dev-frontend:
	cd $(FRONTEND_DIR) && npm run dev

build-frontend:
	cd $(FRONTEND_DIR) && npm run build

start-frontend:
	cd $(FRONTEND_DIR) && npm run start

test-frontend:
	cd $(FRONTEND_DIR) && npm test

lint-frontend:
	cd $(FRONTEND_DIR) && npm run lint

typecheck-frontend:
	cd $(FRONTEND_DIR) && npm run typecheck

docker-frontend:
	docker build -t aicc-frontend $(FRONTEND_DIR)
	docker run --rm -p 3000:3000 aicc-frontend

## Backend targets
dev-backend:
	cd $(BACKEND_DIR) && npm run dev

build-backend:
	cd $(BACKEND_DIR) && npm run build

start-backend:
	cd $(BACKEND_DIR) && npm run start

test-backend:
	cd $(BACKEND_DIR) && npm test

lint-backend:
	cd $(BACKEND_DIR) && npm run lint

typecheck-backend:
	cd $(BACKEND_DIR) && npm run typecheck

docker-backend:
	docker build -t aicc-backend $(BACKEND_DIR)
	docker run --rm -p 4000:4000 aicc-backend

## Crawler targets
dev-crawler:
	cd $(CRAWLER_DIR) && npm run dev

build-crawler:
	cd $(CRAWLER_DIR) && npm run build

start-crawler:
	cd $(CRAWLER_DIR) && npm run start

test-crawler:
	cd $(CRAWLER_DIR) && npm test

lint-crawler:
	cd $(CRAWLER_DIR) && npm run lint

typecheck-crawler:
	cd $(CRAWLER_DIR) && npm run typecheck

docker-crawler:
	docker build -t aicc-crawler $(CRAWLER_DIR)
	docker run --rm aicc-crawler

## Newsletter targets
dev-newsletter:
	cd $(NEWSLETTER_DIR) && npm run dev

build-newsletter:
	cd $(NEWSLETTER_DIR) && npm run build

start-newsletter:
	cd $(NEWSLETTER_DIR) && npm run start

newsletter:
	cd $(NEWSLETTER_DIR) && npm run newsletter

send-newsletter:
	cd $(NEWSLETTER_DIR) && npm run send

lint-newsletter:
	cd $(NEWSLETTER_DIR) && npm run lint

typecheck-newsletter:
	cd $(NEWSLETTER_DIR) && npm run typecheck

docker-newsletter:
	docker build -t aicc-newsletter $(NEWSLETTER_DIR)
	docker run --rm aicc-newsletter

## Aggregate targets
dev:
	@echo "Starting all services in parallel..."
	$(MAKE) dev-frontend   & \
	$(MAKE) dev-backend    & \
	$(MAKE) dev-crawler    & \
	$(MAKE) dev-newsletter & \
	wait

build:
	@echo "Building all services..."
	$(MAKE) build-frontend   && \
	$(MAKE) build-backend    && \
	$(MAKE) build-crawler    && \
	$(MAKE) build-newsletter

start:
	@echo "Starting all services..."
	$(MAKE) start-frontend   && \
	$(MAKE) start-backend    && \
	$(MAKE) start-crawler    && \
	$(MAKE) start-newsletter

test:
	@echo "Running tests for all services..."
	$(MAKE) test-frontend   && \
	$(MAKE) test-backend    && \
	$(MAKE) test-crawler

lint:
	@echo "Linting root and all services..."
	npm run lint
	$(MAKE) lint-frontend   && \
	$(MAKE) lint-backend    && \
	$(MAKE) lint-crawler    && \
	$(MAKE) lint-newsletter

typecheck:
	@echo "Typechecking all services..."
	$(MAKE) typecheck-frontend   && \
	$(MAKE) typecheck-backend    && \
	$(MAKE) typecheck-crawler    && \
	$(MAKE) typecheck-newsletter

docker:
	@echo "Building and running all services via Docker..."
	$(MAKE) docker-frontend   && \
	$(MAKE) docker-backend    && \
	$(MAKE) docker-crawler    && \
	$(MAKE) docker-newsletter

docker-compute:
	@echo "→ Entering compute container shell…"
	./docker_computer.sh

reboot: clean bootstrap dev
