.PHONY: help install test lint format clean docker-build docker-up docker-down deploy-aws deploy-azure

# Default target
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "SynthoraAI Agentic AI Pipeline - Available Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	pip install -r requirements.txt

install-dev: ## Install development dependencies
	pip install -r requirements.txt pytest pytest-asyncio pytest-cov black flake8 mypy

test: ## Run tests
	pytest tests/ -v --cov=agentic_ai --cov-report=html

test-watch: ## Run tests in watch mode
	pytest tests/ -v --looponfail

lint: ## Run linting
	flake8 agentic_ai/ tests/
	mypy agentic_ai/

format: ## Format code
	black agentic_ai/ tests/
	isort agentic_ai/ tests/

clean: ## Clean generated files
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	rm -rf build/ dist/ .pytest_cache/ .coverage htmlcov/

docker-build: ## Build Docker image
	docker build -t synthora-agentic-pipeline:latest .

docker-up: ## Start Docker containers
	docker-compose up -d

docker-down: ## Stop Docker containers
	docker-compose down

docker-logs: ## View Docker logs
	docker-compose logs -f agentic-pipeline

deploy-aws: ## Deploy to AWS
	cd aws && ./deploy.sh production

deploy-azure: ## Deploy to Azure
	cd azure && ./deploy.sh production

run-mcp: ## Run MCP server locally
	python -m agentic_ai.mcp_server.server

run-pipeline: ## Run pipeline example
	python examples/run_pipeline.py

visualize: ## Generate pipeline visualization
	python -c "from agentic_ai.core.pipeline import AgenticPipeline; print(AgenticPipeline().visualize())"

setup-env: ## Setup environment from example
	cp .env.example .env
	@echo "Please edit .env with your configuration"

check: lint test ## Run all checks

all: install lint test ## Install, lint, and test
