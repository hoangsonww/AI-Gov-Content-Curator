# SynthoraAI Agentic AI Pipeline

A sophisticated, production-ready Agentic AI system built with LangGraph and LangChain, featuring assembly line architecture, MCP server integration, and cloud deployment support for AWS and Azure.

## Table of Contents

- [🌟 Overview](#-overview)
  - [Key Features](#key-features)
- [🏗️ Architecture](#-architecture)
  - [System Overview](#system-overview)
  - [Assembly Line Flow](#assembly-line-flow)
  - [Agent Responsibilities](#agent-responsibilities)
- [🎯 Agent Details](#-agent-details)
  - [1. Content Analyzer Agent](#1-content-analyzer-agent)
  - [2. Summarizer Agent](#2-summarizer-agent)
  - [3. Classifier Agent](#3-classifier-agent)
  - [4. Sentiment Analyzer Agent](#4-sentiment-analyzer-agent)
  - [5. Quality Checker Agent](#5-quality-checker-agent)
- [🔌 MCP Server](#-mcp-server)
  - [ACP Layer](#acp-layer)
  - [Available Tools](#available-tools)
  - [Resources](#resources)
  - [Prompts](#prompts)
  - [MCP Integration Flow](#mcp-integration-flow)
- [☁️ Cloud Deployment](#-cloud-deployment)
  - [AWS Architecture](#aws-architecture)
  - [Azure Architecture](#azure-architecture)
- [🚀 Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running Locally](#running-locally)
    - [Start the MCP Server](#start-the-mcp-server)
    - [Run MCP Runtime Preflight](#run-mcp-runtime-preflight)
    - [Use the Pipeline Programmatically](#use-the-pipeline-programmatically)
- [🌩️ Deployment](#-deployment)
  - [Deploy to AWS](#deploy-to-aws)
  - [Deploy to Azure](#deploy-to-azure)
- [📊 Monitoring & Observability](#-monitoring--observability)
  - [Structured Logging](#structured-logging)
  - [Metrics](#metrics)
  - [Health Checks](#health-checks)
- [⚙️ Configuration](#-configuration)
  - [Environment Variables](#environment-variables)
  - [.env Example](#env-example)
- [🧪 Testing](#-testing)
  - [Run Tests](#run-tests)
  - [Example Test](#example-test)
- [📈 Performance](#-performance)
  - [Benchmarks](#benchmarks)
  - [Optimization Tips](#optimization-tips)
- [🔐 Security](#-security)
  - [Best Practices](#best-practices)
  - [API Key Rotation](#api-key-rotation)
- [🤝 Integration](#-integration)
  - [Integrate with Existing Backend](#integrate-with-existing-backend)
  - [MCP Client Integration](#mcp-client-integration)
- [📚 API Reference](#-api-reference)
  - [Pipeline API](#pipeline-api)
    - [`AgenticPipeline.process_article(article_data: Dict) -> Dict`](#agenticpipelineprocessarticlearticledata-dict---dict)
    - [`AgenticPipeline.visualize() -> str`](#agenticpipelinevisualize---str)
- [🛠️ Troubleshooting](#-troubleshooting)
  - [Common Issues](#common-issues)
    - [Pipeline Timeout](#pipeline-timeout)
    - [Low Quality Scores](#low-quality-scores)
    - [Memory Issues](#memory-issues)
- [👥 Contributing](#-contributing)
- [📄 License](#-license)
- [🙏 Acknowledgments](#-acknowledgments)
- [📞 Support](#-support)

## 🌟 Overview

The SynthoraAI Agentic AI Pipeline is an advanced content processing system that leverages multiple specialized AI agents working in concert to analyze, summarize, classify, and quality-check articles. Built on LangGraph's state machine architecture, it provides reliability, scalability, and sophisticated multi-agent orchestration.

### Key Features

- **🤖 Multi-Agent Architecture**: Specialized agents for content analysis, summarization, classification, sentiment analysis, and quality checking
- **🔄 Assembly Line Processing**: LangGraph-based pipeline with state management and conditional routing
- **🔌 MCP Server**: Model Context Protocol server for standardized AI interactions
- **🛰️ ACP (Agent Communication Protocol)**: Production-grade inter-agent messaging (register, heartbeat, send, inbox, ack) backed by Redis for multi-replica safety
- **☁️ Cloud-Ready**: Production deployment configurations for AWS Lambda and Azure Functions
- **📊 Quality Assurance**: Built-in quality checking with automatic retry mechanisms
- **⚡ Production-Ready**: Comprehensive logging, monitoring, error handling, and observability
- **🔐 Secure**: Secrets management with AWS Secrets Manager and Azure Key Vault

---

## 🏗️ Architecture

### System Overview

```mermaid
graph TB
    subgraph "Input Layer"
        A[Article Input] --> B[Intake Node]
    end

    subgraph "Processing Pipeline"
        B --> C[Content Analyzer Agent]
        C --> D[Summarizer Agent]
        D --> E[Classifier Agent]
        E --> F[Sentiment Analyzer Agent]
        F --> G[Quality Checker Agent]
    end

    subgraph "Decision Layer"
        G -->|Quality Check| H{Pass Quality?}
        H -->|Yes| I[Output Node]
        H -->|No & Retries Left| C
        H -->|Max Retries| I
    end

    subgraph "Output Layer"
        I --> J[Processed Results]
        J --> K[Summary]
        J --> L[Topics]
        J --> M[Sentiment]
        J --> N[Quality Score]
    end
```

### Assembly Line Flow

The pipeline implements an assembly line architecture where each agent performs a specific task:

```mermaid
sequenceDiagram
    participant Client
    participant Pipeline
    participant ContentAnalyzer
    participant Summarizer
    participant Classifier
    participant SentimentAnalyzer
    participant QualityChecker

    Client->>Pipeline: Process Article
    Pipeline->>Pipeline: Intake & Validation
    Pipeline->>ContentAnalyzer: Analyze Content
    ContentAnalyzer-->>Pipeline: Content Structure
    Pipeline->>Summarizer: Generate Summary
    Summarizer-->>Pipeline: Summary Text
    Pipeline->>Classifier: Classify Topics
    Classifier-->>Pipeline: Topic List
    Pipeline->>SentimentAnalyzer: Analyze Sentiment
    SentimentAnalyzer-->>Pipeline: Sentiment Data
    Pipeline->>QualityChecker: Check Quality
    alt Quality Pass
        QualityChecker-->>Pipeline: Pass (Score: 0.8+)
        Pipeline-->>Client: Results
    else Quality Fail & Retries Available
        QualityChecker-->>Pipeline: Fail (Score < 0.7)
        Pipeline->>ContentAnalyzer: Retry Processing
    else Max Retries Reached
        QualityChecker-->>Pipeline: Final Result
        Pipeline-->>Client: Results with Warning
    end
```

### Agent Responsibilities

```mermaid
graph LR
    subgraph "Content Analyzer"
        CA1[Extract Structure]
        CA2[Identify Entities]
        CA3[Detect Key Dates]
        CA4[Analyze Style]
    end

    subgraph "Summarizer"
        S1[Extract Main Points]
        S2[Condense Information]
        S3[Generate Summary]
    end

    subgraph "Classifier"
        C1[Analyze Content]
        C2[Match Topics]
        C3[Rank Relevance]
    end

    subgraph "Sentiment Analyzer"
        SA1[Detect Tone]
        SA2[Measure Objectivity]
        SA3[Assess Urgency]
        SA4[Evaluate Controversy]
    end

    subgraph "Quality Checker"
        Q1[Validate Accuracy]
        Q2[Check Completeness]
        Q3[Assess Coherence]
        Q4[Generate Score]
    end
```

---

## 🎯 Agent Details

### 1. Content Analyzer Agent

Extracts structure and key information from articles.

**Outputs:**
- Main topic and subtopics
- Named entities (people, organizations, locations)
- Important dates and events
- Content structure analysis
- Writing style and tone
- Word count and reading time

### 2. Summarizer Agent

Generates concise, accurate summaries.

**Features:**
- Captures main points and key facts
- Maintains factual accuracy
- Uses clear, accessible language
- 150-200 word summaries
- Highlights important takeaways

### 3. Classifier Agent

Categorizes articles into relevant topics.

**Topic Categories:**
- Politics & Governance
- Economy & Finance
- Healthcare
- Education
- Environment & Climate
- Technology & Innovation
- Security & Defense
- Social Issues
- Infrastructure
- International Relations
- Law & Justice
- Public Safety
- Energy
- Transportation
- Science & Research

### 4. Sentiment Analyzer Agent

Analyzes emotional tone and sentiment.

**Analysis Dimensions:**
- Overall sentiment (positive/negative/neutral)
- Sentiment score (-1 to 1)
- Emotional tone
- Objectivity score (0 to 1)
- Urgency level (low/medium/high)
- Controversy level (low/medium/high)
- Key phrases indicating sentiment

### 5. Quality Checker Agent

Validates output quality and completeness.

**Evaluation Criteria:**
- Summary quality (accuracy, completeness, clarity)
- Classification relevance
- Sentiment accuracy
- Overall coherence
- Generates quality score (0 to 1)

---

## 🔌 MCP Server

The Model Context Protocol (MCP) server provides a standardized interface for AI interactions.

For more details, see [mcp_server/README.md](../mcp_server/README.md).

### ACP Layer

ACP complements MCP by enabling durable inter-agent communication with explicit lifecycle semantics.

```mermaid
sequenceDiagram
    participant AgentA as Agent A
    participant MCP as MCP ACP Tools
    participant Store as ACP Store (Redis/Memory)
    participant AgentB as Agent B

    AgentA->>MCP: acp_register_agent(agent-a)
    AgentB->>MCP: acp_register_agent(agent-b)
    AgentA->>MCP: acp_send_message(agent-a -> agent-b)
    MCP->>Store: persist envelope
    AgentB->>MCP: acp_fetch_inbox(agent-b)
    MCP->>Store: mark delivered
    AgentB->>MCP: acp_acknowledge_message(message_id)
    MCP->>Store: mark acknowledged
```

ACP production behavior:
- `ACP_BACKEND=redis` is the default.
- In `ENVIRONMENT=production` with `ACP_ENABLED=true`, Redis backend is strict and fail-fast.
- Preflight validates ACP operational readiness via live roundtrip checks.

### Server Package Layout

The MCP server is organized as a package instead of a monolithic file:

- `mcp_server/app.py`: composition root and server bootstrap
- `mcp_server/tools/`: MCP tool registrations and request flow
- `mcp_server/resources/`: MCP resource registrations
- `mcp_server/prompts/`: MCP prompt registrations
- `mcp_server/runtime.py`: runtime container (pipeline + job store)
- `mcp_server/acp_store.py`: in-memory ACP implementation + protocol
- `mcp_server/acp_redis_store.py`: Redis-backed ACP implementation
- `mcp_server/job_store.py`: async-safe in-memory job retention
- `mcp_server/models.py`: request/status schemas
- `mcp_server/validation.py`: payload and metadata guardrails
- `mcp_server/logging_config.py`: stderr-safe structured logging
- `mcp_server/server.py`: compatibility wrapper entrypoint

### Available Tools

The MCP server now exposes an enterprise-focused tool surface across three domains:

- **Processing lifecycle tools**
- `process_article`, `process_article_batch`, `validate_article_payload`
- `get_processing_status`, `get_processing_result`, `list_processing_jobs`
- `delete_processing_job`, `purge_processing_jobs`
- **Analysis tools**
- `analyze_content`, `analyze_sentiment`, `extract_topics`
- `evaluate_quality`, `compute_text_metrics`, `generate_summary`
- **Operations/diagnostics tools**
- `check_pipeline_health`, `get_pipeline_graph`, `get_runtime_readiness`
- `get_server_capabilities`, `diagnose_provider_configuration`, `run_preflight_checks`
- **ACP tools**
- `acp_register_agent`, `acp_unregister_agent`, `acp_heartbeat`
- `acp_send_message`, `acp_fetch_inbox`, `acp_acknowledge_message`
- `acp_list_agents`, `acp_get_message`

Use `get_server_capabilities` at runtime as the source of truth for current tool inventory.

### Resources

- `config://pipeline`, `config://limits`, `config://providers`, `config://features`
- `runtime://health`, `runtime://readiness`, `runtime://capabilities`, `runtime://pipeline/graph`
- `jobs://stats`, `jobs://recent`, `topics://available`
- `acp://agents`, `acp://stats`, `acp://messages/recent`

### Prompts

- `summarize_article_prompt`, `executive_brief_prompt`
- `analyze_sentiment_prompt`, `classify_article_prompt`, `quality_audit_prompt`
- `red_team_bias_prompt`, `incident_triage_prompt`

### MCP Integration Flow

```mermaid
graph LR
    A[MCP Client] -->|Request| B[MCP Server]
    B -->|Tool Call| C[Agentic Pipeline]
    C -->|Process| D[Agents]
    D -->|Results| C
    C -->|Response| B
    B -->|Result| A
```

---

## ☁️ Cloud Deployment

### AWS Architecture

```mermaid
graph TB
    subgraph "API Layer"
        A[API Gateway] --> B[Lambda Function]
    end

    subgraph "Processing"
        B --> C[Agentic Pipeline]
        C --> D[Content Analyzer]
        C --> E[Summarizer]
        C --> F[Classifier]
        C --> G[Sentiment Analyzer]
        C --> H[Quality Checker]
    end

    subgraph "Storage & Secrets"
        I[S3 Bucket]
        J[Secrets Manager]
        K[CloudWatch]
    end

    subgraph "Queue System"
        L[SQS Queue]
        M[Dead Letter Queue]
    end

    B --> I
    B --> J
    B --> K
    A --> L
    L --> B
    L --> M
```

**AWS Services:**
- **Lambda**: Serverless compute for pipeline execution
- **API Gateway**: REST API endpoint
- **S3**: Storage for artifacts and models
- **SQS**: Asynchronous processing queue
- **Secrets Manager**: Secure API key storage
- **CloudWatch**: Logging and monitoring

### Azure Architecture

```mermaid
graph TB
    subgraph "API Layer"
        A[Azure Functions HTTP] --> B[Function App]
    end

    subgraph "Processing"
        B --> C[Agentic Pipeline]
        C --> D[Content Analyzer]
        C --> E[Summarizer]
        C --> F[Classifier]
        C --> G[Sentiment Analyzer]
        C --> H[Quality Checker]
    end

    subgraph "Storage & Secrets"
        I[Blob Storage]
        J[Key Vault]
        K[Application Insights]
    end

    subgraph "Queue System"
        L[Storage Queue]
        M[Poison Queue]
    end

    B --> I
    B --> J
    B --> K
    A --> L
    L --> B
    L --> M
```

**Azure Services:**
- **Azure Functions**: Serverless compute
- **Storage Queues**: Asynchronous processing
- **Blob Storage**: Artifact storage
- **Key Vault**: Secrets management
- **Application Insights**: Monitoring and analytics

---

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- pip or poetry for package management
- MongoDB (for article storage)
- Redis (for state management)
- API keys:
  - Google AI (Gemini)
  - Pinecone (optional, for vector search)

### Installation

1. **Clone and navigate:**
   ```bash
   cd agentic_ai
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set required environment variables:**
   ```bash
   export MONGODB_URI=your-mongodb-uri
   export GOOGLE_AI_API_KEY=your-google-api-key
   export REDIS_HOST=localhost
   export REDIS_PORT=6379
   ```

### Running Locally

#### Start the MCP Server

```bash
PYTHONPATH=.. python -m mcp_server
```

The MCP server runs over stdio transport and is intended to be launched by an MCP host/client.

#### Run MCP Runtime Preflight

```bash
make mcp-preflight
```

This command exits non-zero when runtime is not ready (for example, missing provider credentials).
It also exits non-zero when ACP operational checks fail.

#### Use the Pipeline Programmatically

```python
import asyncio
from agentic_ai.core.pipeline import AgenticPipeline

# Initialize pipeline
pipeline = AgenticPipeline()

# Process an article
article_data = {
    "id": "article-123",
    "content": "Your article content here...",
    "url": "https://example.com/article",
    "source": "government"
}

# Run pipeline
result = asyncio.run(pipeline.process_article(article_data))

print(f"Summary: {result['summary']}")
print(f"Topics: {result['topics']}")
print(f"Sentiment: {result['sentiment']['overall_sentiment']}")
print(f"Quality Score: {result['quality_score']}")
```

---

## 🌩️ Deployment

### Deploy to AWS

```bash
cd aws
chmod +x deploy.sh
./deploy.sh production
```

See [aws/README.md](aws/README.md) for detailed instructions.

### Deploy to Azure

```bash
cd azure
chmod +x deploy.sh
./deploy.sh production
```

See [azure/README.md](azure/README.md) for detailed instructions.

---

## 📊 Monitoring & Observability

### Structured Logging

All components use structured logging with `structlog`:

```python
logger.info(
    "Article processed",
    article_id=article_id,
    quality_score=quality_score,
    processing_time=elapsed_time
)
```

### Metrics

Prometheus metrics are available on port 9090 (configurable):

- `pipeline_processing_total` - Total articles processed
- `pipeline_processing_duration_seconds` - Processing time histogram
- `pipeline_quality_score` - Quality score distribution
- `agent_execution_duration_seconds` - Per-agent execution time

### Health Checks

Check pipeline health via the `check_pipeline_health` MCP tool from your MCP client.

---

## ⚙️ Configuration

### Environment Variables

See [config/settings.py](config/settings.py) for all configuration options.

Key settings:
- `ENVIRONMENT`: deployment environment (development/staging/production)
- `DEFAULT_LLM_PROVIDER`: LLM provider (google/openai/anthropic)
- `MAX_ITERATIONS`: maximum retry attempts
- `AGENT_TIMEOUT`: agent execution timeout
- `ENABLE_METRICS`: enable Prometheus metrics

### .env Example

```bash
# Application
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO
LOG_JSON=true
APP_VERSION=1.0.0

# LLM Configuration
GOOGLE_AI_API_KEY=your-key-here
DEFAULT_LLM_PROVIDER=google
DEFAULT_MODEL=gemini-1.5-flash
TEMPERATURE=0.7
MAX_TOKENS=2000

# Database
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=synthora_ai

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Vector Store
PINECONE_API_KEY=your-key-here
PINECONE_ENVIRONMENT=us-east-1
PINECONE_INDEX_NAME=synthora-ai

# Pipeline Settings
MAX_ITERATIONS=10
AGENT_TIMEOUT=300
ENABLE_HUMAN_IN_LOOP=false

# MCP Runtime Guardrails
MCP_SERVER_NAME=synthora-agentic-pipeline
MCP_SERVER_VERSION=1.0.0
MCP_MAX_CONTENT_CHARS=20000
MCP_MAX_METADATA_ENTRIES=50
MCP_MAX_METADATA_VALUE_CHARS=2000
MCP_MAX_JOB_HISTORY=1000
MCP_JOB_TTL_SECONDS=86400

# ACP Runtime Guardrails
ACP_ENABLED=true
ACP_BACKEND=redis
ACP_MAX_AGENTS=200
ACP_MAX_MESSAGES=5000
ACP_MESSAGE_TTL_SECONDS=3600
ACP_AGENT_TTL_SECONDS=900
ACP_REDIS_KEY_PREFIX=synthora:acp
ACP_MAX_PAYLOAD_CHARS=20000
ACP_MAX_METADATA_ENTRIES=50
ACP_MAX_CAPABILITIES=32

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090

# Cloud (AWS)
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket

# Cloud (Azure)
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_RESOURCE_GROUP=your-resource-group
```

---

## 🧪 Testing

### Run Tests

```bash
# Install test dependencies
pip install -r requirements.txt

# Run all tests
PYTHONPATH=.. pytest tests/ -v

# Run with coverage
PYTHONPATH=.. pytest tests/ --cov=agentic_ai --cov-report=html
```

### Example Test

```python
import pytest
from agentic_ai.core.pipeline import AgenticPipeline

@pytest.mark.asyncio
async def test_pipeline_processing():
    pipeline = AgenticPipeline()

    result = await pipeline.process_article({
        "id": "test-1",
        "content": "Test article content...",
        "url": "https://test.com",
        "source": "test"
    })

    assert result["article_id"] == "test-1"
    assert result["summary"] is not None
    assert len(result["topics"]) > 0
    assert result["quality_score"] > 0
```

---

## 📈 Performance

### Benchmarks

- **Average processing time**: 5-15 seconds per article
- **Throughput**: 100+ articles/minute (with proper scaling)
- **Quality score**: Average 0.85+
- **Success rate**: 99%+

### Optimization Tips

1. **Use connection pooling** for MongoDB and Redis
2. **Enable caching** for frequently accessed data
3. **Adjust timeout values** based on content length
4. **Scale horizontally** using queues for high volume
5. **Use pre-warmed instances** in cloud deployments

---

## 🔐 Security

### Best Practices

- Store secrets in AWS Secrets Manager or Azure Key Vault
- Use IAM roles and managed identities
- Enable HTTPS-only traffic
- Implement rate limiting
- Validate and sanitize inputs
- Regular security audits

### API Key Rotation

1. Generate new API keys
2. Update in secrets manager
3. Redeploy functions
4. Revoke old keys after grace period

---

## 🤝 Integration

### Integrate with Existing Backend

```python
from agentic_ai.core.pipeline import AgenticPipeline

# In your article processing logic
pipeline = AgenticPipeline()

async def process_new_article(article):
    result = await pipeline.process_article({
        "id": article.id,
        "content": article.content,
        "url": article.url,
        "source": article.source
    })

    # Update article with processed data
    article.summary = result["summary"]
    article.topics = result["topics"]
    article.sentiment = result["sentiment"]
    article.quality_score = result["quality_score"]

    await article.save()
```

### MCP Client Integration

```python
import asyncio
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def run():
    server = StdioServerParameters(
        command="python",
        args=["-m", "mcp_server"],
        env={"PYTHONPATH": "."},
    )
    async with stdio_client(server) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool(
                "process_article",
                {
                    "article_id": "123",
                    "content": "Article content...",
                    "url": "https://example.com",
                    "source": "government",
                },
            )
            print(result)


asyncio.run(run())
```

---

## 📚 API Reference

### Pipeline API

#### `AgenticPipeline.process_article(article_data: Dict) -> Dict`

Process an article through the complete pipeline.

**Parameters:**
- `article_data`: Dictionary with article information

**Returns:**
- Dictionary with processing results

#### `AgenticPipeline.visualize() -> str`

Generate a mermaid diagram of the pipeline.

**Returns:**
- Mermaid diagram string

---

## 🛠️ Troubleshooting

### Common Issues

#### Pipeline Timeout
- Increase `AGENT_TIMEOUT` in settings
- Check network connectivity to LLM providers
- Optimize content preprocessing

#### Low Quality Scores
- Review LLM prompt templates
- Adjust temperature settings
- Increase max_tokens for longer content

#### Memory Issues
- Reduce batch sizes
- Implement pagination for large datasets
- Use streaming for long content

---

## 👥 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

---

## 📄 License

This project is licensed under the MIT License - see [LICENSE](../LICENSE) file for details.

---

## 🙏 Acknowledgments

- **LangChain** & **LangGraph** teams for excellent frameworks
- **Model Context Protocol** for standardized AI interfaces
- **SynthoraAI** core team for integration support

---

## 📞 Support

For questions or issues:
- GitHub Issues: [Create an issue](https://github.com/hoangsonww/AI-Gov-Content-Curator/issues)
- Email: hoangson091104@gmail.com
- Website: [sonnguyenhoang.com](https://sonnguyenhoang.com)

---

**Built with ❤️ by the SynthoraAI Team**
