# MCP + ACP Architecture Guide

This document explains how SynthoraAI uses **MCP (Model Context Protocol)** and **ACP (Agent Communication Protocol)** together for production agent operations.

## Contents

- [Overview](#overview)
- [Why MCP and ACP both exist](#why-mcp-and-acp-both-exist)
- [End-to-end architecture](#end-to-end-architecture)
- [MCP surface (current)](#mcp-surface-current)
- [ACP protocol model](#acp-protocol-model)
- [Redis-backed ACP runtime model](#redis-backed-acp-runtime-model)
- [Production preflight and readiness gates](#production-preflight-and-readiness-gates)
- [Security and operational guardrails](#security-and-operational-guardrails)
- [Deployment patterns](#deployment-patterns)
- [Failure handling and fallback behavior](#failure-handling-and-fallback-behavior)
- [Validation checklist](#validation-checklist)

## Overview

MCP is the host-facing control plane (tool/resource/prompt interface).  
ACP is the agent-facing communication plane (agent registry + message lifecycle).

```mermaid
flowchart LR
    Host[Claude Code / IDE / MCP Client] -->|JSON-RPC over stdio| MCP[FastMCP Server]
    MCP --> Runtime[ServerRuntime]
    Runtime --> Pipeline[LangGraph AgenticPipeline]
    Runtime --> Jobs[ProcessingJobStore]
    Runtime --> ACP[ACP Store]
    ACP --> Redis[(Redis backend)]
```

## Why MCP and ACP both exist

```mermaid
graph TD
    MCPQ[MCP Question: What can the host call?] --> MCPA[Tools/Resources/Prompts]
    ACPQ[ACP Question: How do agents talk to each other reliably?] --> ACPA[Register/Heartbeat/Send/Inbox/Ack]
    MCPA --> Combined[Complete production orchestration]
    ACPA --> Combined
```

- **MCP** gives discoverability, standard invocation, host interoperability.
- **ACP** gives durable delivery semantics for inter-agent coordination.

## End-to-end architecture

```mermaid
flowchart TB
    subgraph HostLayer[Host Layer]
      IDE[Claude Code / IDE]
      IDE --> MCP
    end

    subgraph MCPLayer[MCP Server Layer]
      MCP[FastMCP]
      MCP --> ToolProc[Processing Tools]
      MCP --> ToolOps[Operations Tools]
      MCP --> ToolACP[ACP Tools]
      MCP --> Res[Resources]
      MCP --> Prompts[Prompts]
    end

    subgraph RuntimeLayer[Runtime Layer]
      RT[ServerRuntime]
      RT --> Pipe[AgenticPipeline]
      RT --> Jobs[ProcessingJobStore]
      RT --> ACPStore[ACP Store Abstraction]
    end

    subgraph ACPBackends[ACP Backend Implementations]
      Memory[InMemoryACPStore]
      Redis[RedisACPStore]
    end

    ACPStore --> Memory
    ACPStore --> Redis
    ToolProc --> RT
    ToolOps --> RT
    ToolACP --> RT
```

## MCP surface (current)

```mermaid
mindmap
  root((MCP Surface))
    Tools
      Processing
      Analysis
      Operations
      ACP
    Resources
      Config
      Runtime
      Jobs
      ACP
    Prompts
      Summarization
      Analysis
      Governance
```

### Tool families

- **Processing:** article validation, single/batch processing, job status/result/list/purge.
- **Analysis:** content/sentiment/topics/quality metrics and summary generation.
- **Operations:** health/readiness/capabilities/provider diagnostics/preflight.
- **ACP:** register/unregister/heartbeat/send/fetch/ack/list/get.

### Resource families

- `config://*`, `runtime://*`, `jobs://*`, `topics://available`, `acp://*`.

## ACP protocol model

ACP message lifecycle:

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> delivered: acp_fetch_inbox()
    delivered --> acknowledged: acp_acknowledge_message()
    pending --> expired: TTL prune
    delivered --> expired: TTL prune
    acknowledged --> expired: retention prune
    expired --> [*]
```

ACP actor lifecycle:

```mermaid
stateDiagram-v2
    [*] --> registered: acp_register_agent()
    registered --> active: acp_heartbeat()
    active --> stale: heartbeat ttl exceeded
    stale --> pruned: backend prune
    active --> unregistered: acp_unregister_agent()
    unregistered --> [*]
```

ACP roundtrip:

```mermaid
sequenceDiagram
    participant A as Sender Agent
    participant MCP as MCP ACP Tools
    participant Store as ACP Store
    participant B as Recipient Agent

    A->>MCP: acp_register_agent(sender)
    B->>MCP: acp_register_agent(recipient)
    A->>MCP: acp_send_message(payload)
    MCP->>Store: persist envelope
    B->>MCP: acp_fetch_inbox(limit=..)
    MCP->>Store: transition pending -> delivered
    B->>MCP: acp_acknowledge_message(message_id)
    MCP->>Store: transition delivered -> acknowledged
```

## Redis-backed ACP runtime model

```mermaid
flowchart LR
    Boot[Runtime boot] --> Enabled{ACP_ENABLED}
    Enabled -->|false| Disabled[ACP disabled responses]
    Enabled -->|true| Backend{ACP_BACKEND}
    Backend -->|redis| RedisInit[Init RedisACPStore]
    Backend -->|memory| MemInit[Init InMemoryACPStore]
    RedisInit --> Prod{ENVIRONMENT=production}
    Prod -->|yes + redis unavailable| Fail[Fail-fast RuntimeError]
    Prod -->|yes + redis available| Ready[ACP ready]
    Prod -->|no| Ready
    MemInit --> Ready
```

Redis data layout (logical):

```mermaid
erDiagram
    ACP_AGENTS ||--o{ ACP_HEARTBEAT : tracks
    ACP_AGENTS ||--o{ ACP_INBOX : receives
    ACP_MESSAGES ||--o{ ACP_ORDER : indexed_by_time
    ACP_MESSAGES ||--o{ ACP_INBOX : referenced_by

    ACP_AGENTS {
      string agent_id
      json record
    }
    ACP_HEARTBEAT {
      string agent_id
      float heartbeat_ts
    }
    ACP_MESSAGES {
      string message_id
      json envelope
    }
    ACP_ORDER {
      string message_id
      float created_ts
    }
    ACP_INBOX {
      string agent_id
      string message_id
      float created_ts
    }
```

## Production preflight and readiness gates

`make mcp-preflight` validates:

1. Runtime compiled and pipeline ready.
2. ACP operational checks (`acp_preflight`):
   - Redis ping (when backend is redis)
   - register sender/recipient
   - send message
   - fetch recipient inbox
   - acknowledge message
   - cleanup/unregister

```mermaid
flowchart TD
    Preflight[make mcp-preflight] --> RuntimeReady{runtime.ready?}
    RuntimeReady -->|no| Fail
    RuntimeReady -->|yes| ACPCheck[run acp_preflight]
    ACPCheck --> ACPReady{acp.ready?}
    ACPReady -->|no| Fail
    ACPReady -->|yes| Pass[Preflight pass]
    Fail[Exit code 1]
```

## Security and operational guardrails

- ACP enablement controlled via `ACP_ENABLED`.
- Production strict backend policy:
  - `ENVIRONMENT=production` + `ACP_ENABLED=true` + `ACP_BACKEND=redis` -> fail-fast if Redis unavailable.
- Payload and metadata limits:
  - `ACP_MAX_PAYLOAD_CHARS`
  - `ACP_MAX_METADATA_ENTRIES`
  - `ACP_MAX_CAPABILITIES`
- Message retention controls:
  - `ACP_MAX_MESSAGES`
  - `ACP_MESSAGE_TTL_SECONDS`
- Agent liveness controls:
  - `ACP_AGENT_TTL_SECONDS`

```mermaid
flowchart LR
    Input[ACP request] --> Validate[Size/shape validation]
    Validate --> Authz[Agent identity + recipient checks]
    Authz --> Persist[Store envelope]
    Persist --> Observe[Stats/health/resources]
    Observe --> Preflight[Operational gate]
```

## Deployment patterns

### Local development

```mermaid
graph LR
    Dev[Developer machine] --> MCP
    MCP --> Runtime
    Runtime --> ACPMem[In-memory ACP - fallback allowed]
```

### Staging / production

```mermaid
graph LR
    Pods[MCP runtimes across replicas] --> Redis[(Shared Redis ACP backend)]
    Pods --> Pipeline[Agentic pipeline instances]
    Pods --> Health[Preflight + health endpoints]
```

## Failure handling and fallback behavior

```mermaid
sequenceDiagram
    participant Boot as Runtime Boot
    participant Redis as Redis Client
    Boot->>Redis: initialize backend
    alt Production strict + Redis unavailable
        Redis-->>Boot: error
        Boot-->>Boot: fail-fast RuntimeError
    else Non-production
        Redis-->>Boot: error
        Boot-->>Boot: fallback to memory backend
    end
```

## Validation checklist

- [ ] `pip install -r agentic_ai/requirements.txt`
- [ ] `PYTHONPATH=.. pytest agentic_ai/tests/test_mcp_server_*.py`
- [ ] Redis reachable from runtime environment
- [ ] `ENVIRONMENT=production ACP_ENABLED=true ACP_BACKEND=redis make mcp-preflight`
- [ ] ACP resource checks in MCP host (`acp://stats`, `acp://agents`)
- [ ] Runtime readiness (`get_runtime_readiness`) and health (`check_pipeline_health`) healthy

---

For service-level details, see:
- [agentic_ai/README.md](agentic_ai/README.md)
- [mcp_server/README.md](mcp_server/README.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [AGENTIC-AI.md](AGENTIC-AI.md)
