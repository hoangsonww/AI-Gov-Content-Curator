# SynthoraAI Architecture

This document provides a comprehensive, production-ready view of the SynthoraAI monorepo architecture, including deployment strategies, infrastructure configurations, and operational best practices. It is intended for engineers, DevOps teams, architects, and operators who need to understand how the system is built, deployed, and maintained at enterprise scale.

## Table of Contents

1. [System Context](#system-context)
2. [Service Responsibilities](#service-responsibilities)
3. [Runtime & Infrastructure Topology](#runtime--infrastructure-topology)
4. [Deployment Strategies](#deployment-strategies)
5. [Infrastructure Architecture](#infrastructure-architecture)
6. [Data Flow & Processing](#data-flow--processing)
7. [Conversational AI Stack](#conversational-ai-stack)
8. [Backend Architecture](#backend-architecture)
9. [Crawler Architecture](#crawler-architecture)
10. [Frontend Architecture](#frontend-architecture)
11. [Newsletter Service Architecture](#newsletter-service-architecture)
12. [Agentic AI Pipeline](#agentic-ai-pipeline)
13. [CI/CD Pipelines](#cicd-pipelines)
14. [Monitoring & Observability](#monitoring--observability)
15. [Auto-Scaling & Performance](#auto-scaling--performance)
16. [Multi-Region & High Availability](#multi-region--high-availability)
17. [Security & Compliance](#security--compliance)
18. [Disaster Recovery & Business Continuity](#disaster-recovery--business-continuity)
19. [Configuration Management](#configuration-management)
20. [Data Models & Storage](#data-models--storage)
21. [Operational Runbooks](#operational-runbooks)

---

## System Context

```mermaid
flowchart LR
    subgraph Sources[Trusted Content Sources]
        GovSites[Government Portals]
        NewsAPIs[External News APIs]
    end

    Sources -->|URLs & Metadata| Crawler
    Crawler[[Crawler Service<br/>Next.js API Routes]] -->|Summaries & Topics| MongoDB[(MongoDB Atlas)]
    Crawler -->|Prompts| GoogleAI[(Google Generative AI)]
    Crawler -->|Vectors| Pinecone[(Pinecone)]

    MongoDB --> Backend[[Backend API<br/>Next.js + Express]]
    Backend -->|Cached Responses| Redis[(Redis)]
    Backend -->|REST/JSON| Frontend[[Frontend Web App<br/>Next.js + React]]
    Backend -->|Digest Payload| Newsletter[[Newsletter Service<br/>Next.js Serverless]]
    Newsletter -->|Emails| Subscribers[(Email Recipients)]
    Frontend -->|UX Interactions| Users[(Analysts & Public Visitors)]

    Crawler -.->|Cron Jobs & Shell Scripts| Automation[Makefile & Shell Toolkit]
    Backend -.->|Operational Scripts| Automation
    Backend -.->|AI-Assisted Features| GoogleAI
    Backend -.->|Vector Search| Pinecone
```

**Key Components:**
- **Shared database:** MongoDB Atlas acts as the single source of truth for articles, comments, ratings, newsletter subscribers, chat sessions, and users
- **AI integrations:** Google Generative AI powers summarization, topic extraction, and conversational experiences
- **Vector search:** Pinecone provides semantic search capabilities for the AI chat features
- **Caching layer:** Redis accelerates hot API responses and reduces database load
- **Automation:** Cron jobs (Vercel Cron + shell scripts) coordinate scheduled crawls, data hygiene, and newsletters

---

## Service Responsibilities

| Service | Location | Primary Responsibilities | Key Tech | Deployment Options |
|---------|----------|-------------------------|----------|-------------------|
| **Backend API** | `backend/` | REST endpoints, authentication, comments, ratings, bias analysis, topic extraction, newsletter webhooks, chat assistant, RAG-based Q&A | Next.js, Express, TypeScript, Mongoose, Redis, Pinecone, Google Generative AI | Vercel (serverless), AWS ECS (Fargate), Kubernetes |
| **Crawler** | `crawler/` | Crawl homepages & APIs, deduplicate URLs, fetch full articles (Axios/Cheerio/Puppeteer), summarize via AI, extract topics, vectorize content, upsert to MongoDB & Pinecone | Next.js API routes, Puppeteer, Axios, Cheerio, TypeScript | Vercel (cron), AWS ECS (scheduled tasks), K8s CronJobs |
| **Frontend Web App** | `frontend/` | User-facing portal with article lists, filters, detail views, theming, authentication UX, article discussions, AI chat interface | Next.js, React, Tailwind CSS, TypeScript | Vercel, AWS ECS, Kubernetes, CloudFront CDN |
| **Newsletter Service** | `newsletters/` | Manage subscriber list, generate daily digests, integrate with Resend, subscription/unsubscription endpoints | Next.js API routes, Resend SDK, TypeScript | Vercel (cron), AWS ECS (scheduled tasks), K8s CronJobs |
| **Agentic AI Pipeline** | `agentic_ai/` | LangGraph/LangChain workflows for content enrichment, bias detection, advanced summarization | Python, LangChain, LangGraph, Azure Functions | Azure Functions, AWS Lambda, Kubernetes Jobs |
| **Python Crawler Toolkit** | `python_crawler/` | Async crawling alternative with CLI, concurrency controls, local summarization | Python, aiohttp, Google Generative AI SDK | Manual/CLI, Docker containers |
| **Shell & Make CLI** | `shell/`, `Makefile` | Developer ergonomics, dev servers, builds, scheduled jobs, lint/test runners, multi-service orchestration | Bash, Node.js scripts | Local development, CI/CD pipelines |

---

## Runtime & Infrastructure Topology

```mermaid
flowchart TB
    subgraph Internet["Public Internet"]
        Users[End Users]
        Bots[Search Engines / Crawlers]
    end

    subgraph CDN["Content Delivery Network"]
        CloudFront[CloudFront CDN<br/>Global Edge Locations]
        WAF[AWS WAF<br/>DDoS Protection]
    end

    subgraph LoadBalancing["Load Balancing Layer"]
        GlobalAccel[AWS Global Accelerator<br/>Multi-Region Traffic]
        ALB[Application Load Balancer<br/>Blue/Green Target Groups]
        IstioGW[Istio Gateway<br/>K8s Ingress]
    end

    subgraph Compute["Compute Layer"]
        subgraph AWS["AWS ECS Fargate"]
            ECSBack[Backend Service<br/>Auto-scaling]
            ECSFront[Frontend Service<br/>Auto-scaling]
            ECSCrawler[Crawler Tasks<br/>Scheduled]
            ECSNewsletter[Newsletter Tasks<br/>Scheduled]
        end

        subgraph K8s["Kubernetes Cluster"]
            K8sBack[Backend Rollout<br/>Argo Canary]
            K8sFront[Frontend Rollout<br/>Argo Canary]
            K8sCrawler[Crawler CronJob]
            K8sNewsletter[Newsletter CronJob]
        end
    end

    subgraph Data["Data Layer"]
        MongoDB[(MongoDB Atlas<br/>Multi-Region)]
        Redis[(Redis<br/>Global Datastore)]
        Pinecone[(Pinecone<br/>Vector Index)]
        DynamoDB[(DynamoDB<br/>Global Tables)]
        S3[(S3 Buckets<br/>Cross-Region Replication)]
    end

    subgraph External["External Services"]
        GoogleAI[Google Generative AI<br/>Gemini Models]
        ResendAPI[Resend Email API]
        NewsAPI[News APIs]
    end

    Internet --> CloudFront
    CloudFront --> WAF
    WAF --> GlobalAccel
    GlobalAccel --> ALB
    GlobalAccel --> IstioGW
    ALB --> AWS
    IstioGW --> K8s
    AWS --> Data
    K8s --> Data
    AWS --> External
    K8s --> External
```

**Deployment Paths:**
1. **Vercel Serverless:** Default deployment for rapid iteration and auto-scaling
2. **AWS ECS Fargate:** Production deployment with blue/green strategies and full control
3. **Kubernetes:** Enterprise deployment with canary rollouts, service mesh, and advanced traffic management

---

## Deployment Strategies

### Blue/Green Deployment

**Platform:** AWS ECS with CodeDeploy

**Use Case:** Zero-downtime production releases with instant rollback capability

**Configuration:** `infrastructure/terraform/modules/codedeploy/`

```mermaid
sequenceDiagram
    participant CD as CodeDeploy
    participant Blue as Blue Environment<br/>(Current v1.0)
    participant Green as Green Environment<br/>(New v1.1)
    participant ALB as Application Load Balancer
    participant Users as End Users

    CD->>Green: Deploy new version v1.1
    CD->>Green: Run health checks
    Green-->>CD: Health checks pass
    CD->>ALB: Switch traffic to Green
    ALB->>Users: Route 100% to Green
    Note over Blue: Blue kept running for rollback
    CD->>CD: Wait termination period (5 min)
    CD->>Blue: Terminate Blue if no issues
```

**Benefits:**
- Zero downtime during deployment
- Instant rollback by switching traffic back
- Full environment validation before traffic switch
- Clean separation between old and new versions

**Implementation:**
```bash
# Deploy with blue/green strategy
cd infrastructure
make aws-deploy SERVICE=backend ENVIRONMENT=prod

# Rollback if needed
make aws-rollback-backend
```

### Canary Deployment

**Platform:** Kubernetes with Argo Rollouts + Istio
**Use Case:** Progressive rollout with automated analysis for high-risk changes
**Configuration:** `infrastructure/kubernetes/backend/deployment.yaml`

```mermaid
gantt
    title Canary Deployment Timeline
    dateFormat mm
    axisFormat %M min

    section Traffic Split
    10% canary, 90% stable :00, 5m
    20% canary, 80% stable :05, 5m
    40% canary, 60% stable :10, 5m
    60% canary, 40% stable :15, 5m
    80% canary, 20% stable :20, 5m
    100% canary (promoted) :25, 1m
```

**Automated Analysis Metrics:**
- Success rate ≥ 95%
- P95 latency < 500ms
- Error rate < 5%
- CPU usage < 80%
- Memory usage < 80%

**Traffic Progression:**
1. Deploy canary version
2. Route 10% traffic → analyze for 5 min
3. If metrics pass, increase to 20% → analyze
4. Continue: 40% → 60% → 80% → 100%
5. Auto-rollback if any analysis fails

**Implementation:**
```bash
# Deploy with canary strategy
cd infrastructure
make k8s-deploy SERVICE=backend IMAGE_TAG=v1.2.3

# Watch rollout progress
kubectl argo rollouts get rollout backend -n ai-curator --watch

# Manual promotion after validation
make k8s-promote SERVICE=backend

# Abort on issues
make k8s-abort SERVICE=backend
```

### Rolling Deployment

**Platform:** Kubernetes native rolling updates
**Use Case:** Gradual instance replacement for low-risk updates

**Implementation:**
- Replace instances one at a time
- Wait for health checks before proceeding
- Maintain minimum healthy percentage (75%)
- Automatic rollback on repeated failures

### A/B Testing

**Platform:** Istio VirtualService with header-based routing
**Use Case:** Feature testing with specific user cohorts

```yaml
# Route beta users to canary version
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: backend-ab-test
spec:
  http:
    - match:
        - headers:
            X-User-Group:
              exact: "beta"
      route:
        - destination:
            host: backend-canary
          weight: 100
    - route:
        - destination:
            host: backend
          weight: 100
```

---

## Infrastructure Architecture

### AWS ECS Architecture

```mermaid
graph TB
    subgraph VPC["VPC (Multi-AZ)"]
        subgraph PublicSubnets["Public Subnets"]
            NAT1[NAT Gateway AZ-1]
            NAT2[NAT Gateway AZ-2]
            NAT3[NAT Gateway AZ-3]
            ALB[Application Load Balancer<br/>+ AWS WAF]
        end

        subgraph PrivateSubnets["Private Subnets"]
            subgraph AZ1["Availability Zone 1"]
                Fargate1[ECS Fargate Tasks]
            end
            subgraph AZ2["Availability Zone 2"]
                Fargate2[ECS Fargate Tasks]
            end
            subgraph AZ3["Availability Zone 3"]
                Fargate3[ECS Fargate Tasks]
            end
        end
    end

    subgraph Deployment["Deployment Orchestration"]
        CodeDeploy[CodeDeploy<br/>Blue/Green Controller]
        EventBridge[EventBridge Rules<br/>Scheduled Tasks]
    end

    subgraph Storage["Persistent Storage"]
        SSM[SSM Parameter Store<br/>Secrets]
        ECR[Elastic Container Registry<br/>Docker Images]
        S3Logs[S3 Buckets<br/>ALB Logs & Backups]
    end

    ALB --> Fargate1
    ALB --> Fargate2
    ALB --> Fargate3
    CodeDeploy --> ALB
    EventBridge --> Fargate1
    Fargate1 --> SSM
    Fargate2 --> SSM
    Fargate3 --> SSM
```

**Key Components:**
- **VPC:** Isolated network across 3 availability zones
- **Public Subnets:** ALB, NAT Gateways for internet access
- **Private Subnets:** ECS Fargate tasks with no direct internet exposure
- **Target Groups:** Blue and Green groups for zero-downtime deployments
- **CodeDeploy:** Orchestrates blue/green traffic shifting
- **CloudWatch:** Metrics, logs, dashboards, and alarms
- **SSM Parameter Store:** Encrypted secrets management

**Terraform Modules:**
- `infrastructure/terraform/modules/vpc/` - VPC with multi-AZ subnets
- `infrastructure/terraform/modules/alb/` - ALB with WAF integration
- `infrastructure/terraform/modules/ecs/` - ECS cluster with Fargate
- `infrastructure/terraform/modules/ecs-service/` - Service definitions with auto-scaling
- `infrastructure/terraform/modules/codedeploy/` - Blue/Green deployment configuration

### Kubernetes Architecture

```mermaid
graph TB
    subgraph Cluster["Kubernetes Cluster"]
        subgraph Ingress["Ingress Layer"]
            IstioGW[Istio Ingress Gateway<br/>TLS Termination]
        end

        subgraph ServiceMesh["Service Mesh (Istio)"]
            VS[VirtualServices<br/>Traffic Routing]
            DR[DestinationRules<br/>Load Balancing & Circuit Breaking]
        end

        subgraph Workloads["Application Workloads"]
            subgraph ArgoNS["ai-curator namespace"]
                BackendRollout[Backend Argo Rollout<br/>Canary Strategy]
                FrontendRollout[Frontend Argo Rollout<br/>Canary Strategy]
                CrawlerCron[Crawler CronJob<br/>Daily Schedule]
                NewsletterCron[Newsletter CronJob<br/>Daily Schedule]
            end
        end

        subgraph Monitoring["Monitoring Stack"]
            Prometheus[Prometheus<br/>Metrics Collection]
            Grafana[Grafana<br/>Dashboards]
            AlertManager[AlertManager<br/>Alert Routing]
        end

        subgraph Progressive["Progressive Delivery"]
            ArgoRollouts[Argo Rollouts Controller<br/>Canary Orchestration]
            AnalysisTemplates[Analysis Templates<br/>Prometheus Queries]
        end
    end

    IstioGW --> VS
    VS --> DR
    DR --> BackendRollout
    DR --> FrontendRollout
    ArgoRollouts --> BackendRollout
    ArgoRollouts --> FrontendRollout
    Prometheus --> AnalysisTemplates
    AnalysisTemplates --> ArgoRollouts
    Prometheus --> Grafana
    Prometheus --> AlertManager
```

**Key Components:**
- **Istio Service Mesh:** Traffic management, observability, security
- **Argo Rollouts:** Progressive delivery controller for canary deployments
- **Prometheus:** Metrics collection and alerting rules
- **Grafana:** Visualization and dashboards
- **Analysis Templates:** Automated canary validation via Prometheus metrics

**Kubernetes Resources:**
- `infrastructure/kubernetes/namespace.yaml` - Namespace isolation
- `infrastructure/kubernetes/backend/deployment.yaml` - Backend Argo Rollout
- `infrastructure/kubernetes/frontend/deployment.yaml` - Frontend Argo Rollout
- `infrastructure/kubernetes/cronjobs/` - Scheduled task definitions
- `infrastructure/kubernetes/istio/gateway.yaml` - Istio traffic management
- `infrastructure/kubernetes/monitoring/` - Prometheus & Grafana stack

---

## Data Flow & Processing

### End-to-End Data Flow

```mermaid
sequenceDiagram
    participant Cron as Scheduler<br/>(Vercel Cron / EventBridge / K8s CronJob)
    participant Crawl as Crawler Service
    participant AI as Google Generative AI<br/>(Gemini Models)
    participant Vector as Pinecone<br/>(Vector Index)
    participant DB as MongoDB Atlas
    participant Back as Backend API
    participant Cache as Redis Cache
    participant Mail as Newsletter Service
    participant UI as Frontend Web App
    participant User as End User

    Cron->>Crawl: Trigger fetchAndSummarize (6:00 AM UTC)
    Crawl->>AI: Summarize & extract topics from articles
    AI-->>Crawl: Return summary, topics, bias analysis
    Crawl->>AI: Generate embeddings (text-embedding-004)
    AI-->>Crawl: Return vector embeddings
    Crawl->>DB: Upsert articles with metadata
    Crawl->>Vector: Upsert article vectors

    Note over Mail: Daily newsletter trigger (9:00 AM UTC)
    Cron->>Mail: Trigger newsletter generation
    Mail->>Back: Request latest curated articles
    Back->>Cache: Check cached article list
    alt Cache Miss
        Back->>DB: Query recent articles
        Back->>Cache: Store in cache (TTL: 1 hour)
    end
    Back-->>Mail: Return article payload
    Mail->>Mail: Generate HTML digest
    Mail->>Subscribers: Send via Resend API

    User->>UI: Browse articles
    UI->>Back: Request paginated article list
    Back->>Cache: Check cache
    alt Cache Hit
        Cache-->>Back: Return cached data
    else Cache Miss
        Back->>DB: Query MongoDB
        Back->>Cache: Store result
        DB-->>Back: Return articles
    end
    Back-->>UI: Return JSON response

    User->>UI: Ask AI question (sitewide chat)
    UI->>Back: POST /api/chat/sitewide
    Back->>AI: Generate query embedding
    AI-->>Back: Return query vector
    Back->>Vector: Semantic search (topK=5)
    Vector-->>Back: Return relevant article matches
    Back->>AI: Stream response with context (Gemini 2.0 Flash)
    AI-->>Back: Stream tokens with citations
    Back-->>UI: SSE stream (chunks + citations + warnings)
    UI->>User: Display streaming response
```

### Request Lifecycle (User → API → Data)

```mermaid
flowchart LR
    Browser["Browser<br/>(Next.js pages)"] --> Edge["Vercel Edge / CloudFront<br/>OR<br/>ALB / Istio Gateway"]
    Edge --> Router["Express/Next.js Router<br/>(src/routes, pages/api)"]
    Router --> Authz["JWT Middleware<br/>(auth.middleware.ts)"]
    Authz --> Controller["Controller Layer<br/>(article/chat/newsletter)"]
    Controller --> Service["Service Layer<br/>(Domain Logic)"]
    Service --> Cache["Redis Cache<br/>(Hot Lists/Details)"]
    Service --> Mongo["MongoDB Atlas<br/>(Primary Data)"]
    Service --> Pinecone["Pinecone<br/>(Vector Search)"]
    Service --> Gemini["Google Generative AI<br/>(Gemini Models)"]
    Cache --> Response["JSON Response"]
    Mongo --> Response
    Pinecone --> Response
    Gemini --> Response
    Response --> Browser
```

---

## Conversational AI Stack

### Architecture Overview

The system supports two AI-powered conversation modes:

1. **Article-level Q&A:** Answers questions about a single article using that article's content as context
2. **Sitewide chat (Global RAG):** Answers open-ended questions across the entire corpus using Pinecone vector search

```mermaid
flowchart LR
    User[User Question] --> EntryQnA[Article Page Q&A]
    User --> EntrySitewide[Sitewide Chat UI]

    subgraph ArticleQnA[Article Q&A Path]
        EntryQnA --> UseArticle[Use current article<br/>title + content]
        UseArticle --> GeminiQnA[Gemini API<br/>gemini-2.0-flash-lite<br/>+ retries]
        GeminiQnA --> AnswerA[Direct answer<br/>with short history]
    end

    subgraph SitewideRAG[Sitewide Chat Path - RAG]
        EntrySitewide --> Embed[Embed query<br/>text-embedding-004]
        Embed --> PineconeSearch[Semantic Search<br/>Pinecone ai-gov-articles<br/>topK=5]
        PineconeSearch --> Context[Build context block<br/>Source 1-5:<br/>titles + URLs + summaries]
        Context --> GeminiRag[Gemini 2.0 Flash<br/>SSE streaming<br/>+ failover models]
        GeminiRag --> Guardrails[Hallucination Detection<br/>invalid citations, unsupported claims, suspicious numbers]
        Guardrails --> StreamUI[SSE Events<br/>status/context/citations/chunk/warnings/done]
    end

    AnswerA --> DisplayA[Render in article detail page]
    StreamUI --> DisplayS[Render streaming text<br/>+ clickable citations<br/>+ warning banners]
```

### Sitewide Chat Streaming Contract

```mermaid
sequenceDiagram
    participant UI as Frontend (ai_chat.tsx)
    participant API as POST /api/chat/sitewide
    participant Vec as Pinecone Index
    participant LLM as Gemini 2.0 Flash

    UI->>API: { userMessage, history (trimmed) }
    API->>Vec: Embed query + topK=5 search
    Vec-->>API: Matches: [{ id, title, url, score, summary }]
    API->>LLM: Context + guardrails + history
    Note over LLM: Stream tokens
    LLM-->>API: Token chunks
    loop Streaming
        API-->>UI: SSE: data: {"type":"status","message":"Searching..."}
        API-->>UI: SSE: data: {"type":"context","sources":[...]}
        API-->>UI: SSE: data: {"type":"chunk","content":"text"}
        API-->>UI: SSE: data: {"type":"citations","citations":[...]}
        API-->>UI: SSE: data: {"type":"warnings","warnings":[...]}
    end
    API-->>UI: SSE: data: {"type":"done"}
    UI-->>UI: Append chunks, hydrate sources, show warnings
```

**Key Features:**
- **Streaming responses:** Server-Sent Events (SSE) for low-latency token delivery
- **Citation tracking:** Every claim is linked to source articles
- **Hallucination detection:** Automated checks for invalid citations, unsupported claims, and suspicious numbers
- **Failover mechanisms:** Multiple Gemini API keys and model rotation for reliability
- **History management:** Automatic compaction to respect token limits

---

## Backend Architecture

```mermaid
flowchart TB
    subgraph Entry["API Entry Points"]
        Routes["Express Routes<br/>(src/routes)"]
        Pages["Next.js API Pages<br/>(src/pages/api/*)"]
    end
    Routes --> Controllers
    Pages --> Controllers

    subgraph App["Application Layer"]
        Controllers["Controllers<br/>(src/controllers)"] --> Middleware["Middleware<br/>(src/middleware)"]
        Middleware --> Services["Domain Services<br/>(src/services)"]
        Services --> Utils["Utilities<br/>(src/utils)"]
    end

    subgraph Data["Persistence"]
        Utils --> Models["Mongoose Models<br/>(src/models)"]
        Models --> MongoDB["MongoDB Atlas<br/>Primary Database"]
        Utils --> Redis["Redis Cache<br/>Hot Data"]
        Utils --> Pinecone["Pinecone<br/>Vector Index"]
    end

    Services --> External["External APIs"]
    External -->|Summaries & Embeddings| GoogleAI["Google Generative AI"]
    External -->|News Data| NewsAPI["News API"]
    External -->|Email Delivery| Resend["Resend API"]
```

**Layer Responsibilities:**

- **Controllers:** Thin orchestration mapping HTTP routes to service operations
  - `article.controller.ts` - Article CRUD and listing
  - `auth.controller.ts` - Authentication and authorization
  - `chat.controller.ts` - AI chat endpoints (article Q&A + sitewide)
  - `biasAnalysis.controller.ts` - Bias detection and analysis
  - `newsletter.controller.ts` - Newsletter subscription management

- **Services:** Encapsulate business logic and external integrations
  - `summarization.service.ts` - AI-powered content summarization
  - `topicExtractor.service.ts` - Topic and entity extraction
  - `biasAnalysis.service.ts` - Bias detection algorithms
  - `crawler.service.ts` - Web scraping and content fetching
  - `apiFetcher.service.ts` - Third-party API integrations
  - `pinecone.service.ts` - Vector search operations

- **Middleware:**
  - `auth.middleware.ts` - JWT validation and user context
  - Rate limiting and request validation

- **Utilities:**
  - `utils/logger.ts` - Centralized logging (Winston)
  - `utils/redis.ts` - Cache helpers and connection management

- **Scheduling:**
  - `src/schedule/fetchAndSummarize.ts` - Backup ingestion pipeline (Vercel cron)

---

## Crawler Architecture

```mermaid
flowchart TB
    Start["Homepage & API Seeds<br/>(Government sites + News APIs)"] --> FanOut{"Batch & Concurrency Control<br/>FETCH_CONCURRENCY<br/>CRAWL_CONCURRENCY"}
    FanOut --> CrawlHome["Crawl Homepages<br/>(services/crawler.service.ts)"]
    FanOut --> FetchAPI["Fetch NewsAPI<br/>(services/apiFetcher.service.ts)"]
    CrawlHome --> Dedupe["Deduplicate URLs<br/>(Check MongoDB)"]
    FetchAPI --> Dedupe
    Dedupe --> FetchPage["Fetch Article Page<br/>Axios → Cheerio<br/>Puppeteer fallback"]
    FetchPage --> Summarize["Summarize Content<br/>(services/summarization.service.ts)<br/>Gemini API"]
    Summarize --> Topics["Extract Topics<br/>(services/topicExtractor.service.ts)<br/>Entity recognition"]
    Topics --> Vectorize["Generate Embeddings<br/>(text-embedding-004)"]
    Vectorize --> Upsert["Upsert to MongoDB<br/>(models/article.model.ts)"]
    Upsert --> UpsertVector["Upsert to Pinecone<br/>(Vector index)"]
    UpsertVector --> Cleanup["Cleanup & Prune<br/>(scripts/cleanData.ts)<br/>Remove old articles"]
    Cleanup --> Monitor["Log Status<br/>Health endpoint"]
```

**Resilience Features:**
- **Retry Logic:** Exponential backoff for failed requests
- **Puppeteer Fallback:** JavaScript-rendered pages handled automatically
- **Timeout Guards:** Per-request and per-batch timeouts
- **Concurrency Control:** Configurable limits to respect rate limits
- **Deduplication:** URL-based checks before fetching

**Scripts & Utilities:**
- `scripts/fetchLatestArticles.ts` - CLI tool for manual crawling
- `scripts/cleanData.ts` - Data pruning and maintenance
- `schedule/fetchAndSummarize.ts` - Scheduled ingestion workflow

---

## Frontend Architecture

```mermaid
flowchart TB
    App["_app.tsx / _document.tsx<br/>Global Providers"] --> Layout["Layout Component<br/>Navbar + Footer"]
    Layout --> Pages["Page Routes (pages/)"]
    Pages --> Components["Feature Components<br/>(components/)"]
    Components --> Services["Data Fetching<br/>(services/)"]
    Services --> BackendAPI["Backend REST API<br/>(fetch/axios)"]
    Components --> UIState["State & Hooks<br/>(useState, useContext)"]
    UIState --> Styling["Tailwind CSS<br/>Dark/Light Themes"]
    Components --> Tests["E2E Tests<br/>(Playwright)"]
```

**Key Pages:**
- `pages/index.tsx` - Homepage with hero slider and latest articles
- `pages/articles/[id].tsx` - Article detail view with Q&A chat
- `pages/ai_chat.tsx` - Sitewide AI chat interface with RAG
- `pages/api/health.ts` - Health check endpoint

**Features:**
- **Server-Side Rendering (SSR):** Initial page load optimized for SEO
- **Static Generation (SSG):** Build-time pre-rendering for static content
- **Dark/Light Mode:** `ThemeToggle` component with persistent preferences
- **Responsive Design:** Mobile-first Tailwind utilities
- **Accessibility:** ARIA labels and keyboard navigation

**Testing:**
- Playwright end-to-end suites for critical user flows
- Jest + React Testing Library for component tests

---

## Newsletter Service Architecture

```mermaid
flowchart LR
    subgraph API["Next.js API Routes"]
        Subscribe["/api/newsletter/subscribe"]
        Unsubscribe["/api/newsletter/unsubscribe"]
        Cron["/api/scheduled/sendNewsletter<br/>(Vercel Cron / EventBridge)"]
    end

    API --> Logic["Newsletter Logic<br/>(schedule/sendNewsletter.ts)"]
    Logic --> BackendAPI["Backend REST API<br/>Fetch latest articles"]
    Logic --> Mongo["MongoDB Subscribers<br/>(newsletterSubscriber.model.ts)"]
    Logic --> EmailGen["Email Generation<br/>HTML templates"]
    EmailGen --> Resend["Resend Email API<br/>Batch delivery"]
    Resend --> Subscribers["Email Recipients"]
    Pages["Landing Page<br/>(pages/index.tsx)"] --> Users["User Subscription Forms"]
```

**Workflow:**
1. **Daily Trigger:** Scheduled at 9:00 AM UTC via cron
2. **Article Aggregation:** Fetch top 10 most recent curated articles from backend API
3. **Digest Generation:** Truncate summaries and format HTML email
4. **Batch Delivery:** Send to all active subscribers via Resend
5. **Unsubscribe Handling:** One-click unsubscribe links with backend integration

---

## Agentic AI Pipeline

The `agentic_ai/` package provides LangGraph/LangChain-based workflows for advanced content enrichment.

```mermaid
flowchart LR
    Inputs["Inputs<br/>(Article URLs, metadata)"] --> Planner["Orchestrator<br/>(LangGraph flows)"]
    Planner --> Fetcher["Fetch & Parse<br/>(HTML extraction)"]
    Fetcher --> Summarizer["Gemini Summarization<br/>+ Bias prompts"]
    Summarizer --> Tagger["Topic/Entity Tagging<br/>(NER models)"]
    Tagger --> Vectorizer["Embedding Generation<br/>(text-embedding-004)"]
    Vectorizer --> Pinecone[(Pinecone Index)]
    Tagger --> Mongo[(MongoDB)]
    Pinecone -->|Semantic search| ChatCtlr["Backend Chat Controller<br/>(handleSitewideChat)"]
    Mongo --> API["Backend REST API"]
```

**Features:**
- **Multi-agent Workflows:** Modular agents for fetching, summarizing, tagging
- **Bias Detection:** Specialized prompts to identify political bias
- **Deployment:** Azure Functions (current), AWS Lambda (planned), Kubernetes Jobs

See `agentic_ai/README.md` for detailed architecture and deployment instructions.

---

## CI/CD Pipelines

### GitHub Actions (Current Lightweight Pipeline)

**File:** `.github/workflows/workflow.yml`

**Triggers:** Push to `main`, `master`

**Stages:**
1. **Lint & Format:** ESLint, Prettier checks across all services
2. **Unit Tests:** Jest tests for backend, frontend, crawler (Node 18, 20, 22)
3. **E2E Tests:** Playwright tests for critical user flows
4. **Docker Build:** Build images for all services
5. **Security Scan:** Snyk for vulnerabilities (optional)
6. **Image Push:** Push to GitHub Container Registry (GHCR)

**Badge:** Visible in README showing build status

### CircleCI (Enhanced Pipeline)

**File:** `.circleci/config.yml`

**Features:**
- **Parallel Testing:** Services tested concurrently for speed
- **Terraform Workflows:** Plan → Manual Approval → Apply
- **Blue/Green AWS:** Automated CodeDeploy deployments
- **Canary K8s:** Argo Rollouts with automated promotion
- **Smoke Tests:** Post-deployment health checks
- **Slack Notifications:** Deployment status alerts

**Workflow:**
```
Commit → Test (parallel) → Build Images → Terraform Plan →
[Manual Approval for Prod] → Deploy (Blue/Green or Canary) →
Smoke Tests → Notify Slack
```

### Jenkins (Full-Featured Pipeline)

**File:** `Jenkinsfile`

**Parameters:**
- `ENVIRONMENT`: dev, staging, prod
- `DEPLOYMENT_STRATEGY`: blue-green, canary, rolling, recreate
- `PLATFORM`: aws, kubernetes, both
- `IMAGE_TAG`: Docker image tag
- `RUN_SECURITY_SCAN`: Enable Snyk + Trivy scanning
- `RUN_PERFORMANCE_TESTS`: Enable k6 load testing
- `AUTO_APPROVE`: Skip manual approval gates

**Stages:**
1. **Checkout:** Clone repo and extract Git metadata
2. **Install Dependencies:** Parallel npm ci for all services
3. **Lint & Format:** ESLint, Prettier
4. **Unit Tests:** Jest with coverage reports
5. **Build Docker Images:** Multi-stage builds with layer caching
6. **Security Scanning:** Snyk (dependencies) + Trivy (images)
7. **Push Images:** ECR (AWS) or GHCR
8. **Terraform Plan:** Infrastructure changes preview
9. **Manual Approval:** Production gate (unless AUTO_APPROVE=true)
10. **Deploy:** Execute deployment scripts based on PLATFORM and STRATEGY
11. **Smoke Tests:** Health checks and basic API validation
12. **Performance Tests (Optional):** k6 load testing
13. **Notifications:** Slack alerts with deployment summary

**Deployment Scripts:**
- `infrastructure/scripts/deploy-aws.sh` - AWS ECS blue/green deployments
- `infrastructure/scripts/deploy-k8s.sh` - Kubernetes canary deployments with Argo

---

## Monitoring & Observability

### Metrics Collection

#### CloudWatch (AWS ECS)

**Dashboards:** `infrastructure/terraform/modules/monitoring/`

**Key Metrics:**
- **Service Health:** Task count, running tasks, pending tasks
- **Resource Utilization:** CPU, memory per service
- **Load Balancer:** Request count, target response time, 4xx/5xx errors
- **Auto-Scaling Events:** Scale-out/scale-in actions

**Access:**
```bash
cd infrastructure/terraform && terraform output cloudwatch_dashboard_url
```

#### Prometheus (Kubernetes)

**Configuration:** `infrastructure/kubernetes/monitoring/prometheus.yaml`

**Metrics:**
- Application metrics via instrumentation
- Istio service mesh metrics (request rate, latency, error rate)
- Custom business metrics (articles processed, emails sent)
- Canary analysis metrics for Argo Rollouts

**Query Examples:**
```promql
# Success rate
sum(rate(http_requests_total{status!~"5.."}[5m]))
/
sum(rate(http_requests_total[5m]))

# P95 latency
histogram_quantile(0.95,
  sum(rate(http_request_duration_milliseconds_bucket[5m])) by (le)
)

# Error rate by service
sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)
```

### Dashboards

#### Grafana

**Configuration:** `infrastructure/kubernetes/monitoring/grafana.yaml`

**Pre-built Dashboards:**
1. **Service Overview:** Request rate, latency, error rate (RED metrics)
2. **Deployment Metrics:** Canary weight, rollout status, analysis results
3. **Infrastructure Metrics:** CPU, memory, network, disk usage
4. **Business Metrics:** Articles processed, users active, newsletters sent

**Access:**
```bash
make monitoring-dashboard
# Opens http://localhost:3000
# Username: admin
# Password: changeme123 (rotate in production!)
```

### Logging

#### CloudWatch Logs (AWS)

**Log Groups:**
- `/ecs/ai-curator-prod-backend`
- `/ecs/ai-curator-prod-frontend`
- `/ecs/ai-curator-prod-crawler`
- `/ecs/ai-curator-prod-newsletter`

**CloudWatch Logs Insights Queries:**
```sql
-- Find errors in last hour
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100

-- Top error messages
fields @message
| filter @message like /ERROR/
| stats count() by @message
| sort count desc
| limit 20
```

#### Kubernetes Logs

**Tools:**
- `kubectl logs` for individual pods
- `stern` for multi-pod tailing
- EFK stack (Elasticsearch, Fluentd, Kibana) for centralized logging

**Example Commands:**
```bash
# Tail backend logs
kubectl logs -f -l app=backend -n ai-curator --tail=100

# Multi-pod tailing with stern
stern backend -n ai-curator

# Search for errors
kubectl logs -l app=backend -n ai-curator --tail=1000 | grep ERROR
```

### Distributed Tracing

**Platform:** Istio + Jaeger

**Configuration:** `infrastructure/kubernetes/istio/`

**Features:**
- End-to-end request tracing across microservices
- Latency breakdown by service
- Error propagation visualization

**Access:**
```bash
kubectl port-forward -n istio-system svc/jaeger-query 16686:16686
# Open http://localhost:16686
```

### Alerting

#### Critical Alerts (PagerDuty / SNS)

**Conditions:**
- Service down > 2 minutes
- Error rate > 5%
- P95 latency > 2 seconds
- Deployment failure
- Database connection failures

#### Warning Alerts (Slack)

**Conditions:**
- CPU usage > 80%
- Memory usage > 80%
- Disk usage > 90%
- Canary rollout stuck
- Cache hit rate < 70%

**Configuration:**
```yaml
# infrastructure/kubernetes/monitoring/prometheus.yaml
- alert: HighErrorRate
  expr: |
    sum(rate(http_requests_total{status=~"5.."}[5m]))
    /
    sum(rate(http_requests_total[5m]))
    > 0.05
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "High error rate detected"
    description: "Error rate is {{ $value | humanizePercentage }}"
```

---

## Auto-Scaling & Performance

### Auto-Scaling Strategies

#### Target Tracking Scaling

**Platform:** AWS ECS, Kubernetes HPA

**Metrics:**
- CPU Utilization: Target 70%
- Memory Utilization: Target 70%
- Request Count per Target: Target 1000 requests/minute

**Configuration:**
```hcl
# infrastructure/terraform/modules/ecs-service/main.tf
resource "aws_appautoscaling_policy" "cpu" {
  policy_type = "TargetTrackingScaling"

  target_tracking_scaling_policy_configuration {
    target_value = 70.0
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}
```

#### Scheduled Scaling

**Use Case:** Predictable traffic patterns (business hours)

**Configuration:** `infrastructure/terraform/autoscaling-advanced.tf`

**Schedule:**
- **Morning Scale-Up (7 AM Mon-Fri):** Min 5, Max 20 tasks
- **Evening Scale-Down (8 PM Mon-Fri):** Min 2, Max 10 tasks

```hcl
resource "aws_appautoscaling_scheduled_action" "scale_up_morning" {
  schedule = "cron(0 7 * * MON-FRI *)"
  scalable_target_action {
    min_capacity = 5
    max_capacity = 20
  }
}
```

#### Predictive Scaling

**Platform:** AWS Auto Scaling (ECS + EC2)

**Configuration:** `infrastructure/terraform/autoscaling-advanced.tf`

**Features:**
- ML-based capacity forecasting
- Proactive scaling before traffic spikes
- Scheduling buffer: 10 minutes
- Mode: ForecastAndScale

```hcl
resource "aws_autoscaling_policy" "predictive_scaling" {
  policy_type = "PredictiveScaling"

  predictive_scaling_configuration {
    metric_specification {
      target_value = 70.0
      predefined_load_metric_specification {
        predefined_metric_type = "ASGTotalCPUUtilization"
      }
    }
    mode = "ForecastAndScale"
    scheduling_buffer_time = 600
  }
}
```

#### Step Scaling

**Use Case:** Aggressive scaling for sudden traffic spikes

**Configuration:**
- CPU > 70%: Scale out by 10%
- CPU > 80%: Scale out by 20%
- CPU > 90%: Scale out by 30%

#### SQS-Based Scaling

**Use Case:** Worker tasks processing queued articles

**Metrics:** Queue depth (ApproximateNumberOfMessagesVisible)

**Target:** 10 messages per task

**Configuration:**
```hcl
resource "aws_appautoscaling_policy" "sqs_scaling" {
  policy_type = "TargetTrackingScaling"

  target_tracking_scaling_policy_configuration {
    target_value = 10
    customized_metric_specification {
      metric_name = "ApproximateNumberOfMessagesVisible"
      namespace   = "AWS/SQS"
      statistic   = "Average"
    }
  }
}
```

### Performance Optimization

#### Caching Strategy

**Redis Cache:**
- **Hot Article Lists:** TTL 1 hour
- **Article Details:** TTL 30 minutes
- **User Sessions:** TTL 24 hours
- **Eviction Policy:** LRU (Least Recently Used)

**Pinecone Embedding Cache:**
- **Process-level caching:** In-memory cache for repeated queries
- **Cache invalidation:** On article updates/deletes

**MongoDB Indexes:**
- `_id` (default primary key)
- `createdAt` (for temporal queries)
- `topics` (for category filtering)
- `articleId` (for relationships)

#### Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Article list API (p95) | < 400ms | Redis-backed hot paths |
| Article detail API (p95) | < 300ms | Cached responses |
| Sitewide chat first token (p95) | < 3s | SSE, key rotation |
| Crawler batch completion | < 15 min | Concurrency tuning |
| Newsletter send | < 5 min | Resend batch throughput |

#### Cost Optimization

**Fargate Spot Instances:**
- **Strategy:** 70% Spot, 30% On-Demand
- **Savings:** ~70% on compute costs
- **Risk Mitigation:** Auto-fallback to On-Demand on interruption

**Configuration:**
```hcl
default_capacity_provider_strategy {
  capacity_provider = "FARGATE_SPOT"
  weight            = 70
  base              = 0
}

default_capacity_provider_strategy {
  capacity_provider = "FARGATE"
  weight            = 30
  base              = 1  # At least 1 On-Demand task
}
```

**Cost Reporting:**
- **Lambda Function:** `cost-optimizer`
- **Schedule:** Daily at 9:00 AM
- **Reports:** Cost analysis, optimization recommendations

---

## Multi-Region & High Availability

### Multi-Region Architecture

**Regions:**
- **Primary:** us-east-1 (N. Virginia)
- **Secondary:** us-west-2 (Oregon)
- **Tertiary:** eu-west-1 (Ireland)

**Configuration:** `infrastructure/terraform/multi-region.tf`

```mermaid
graph TB
    subgraph Global["Global Layer"]
        Route53[Route53<br/>DNS + Health Checks]
        GlobalAccel[Global Accelerator<br/>Anycast IPs]
        CloudFront[CloudFront CDN<br/>Edge Locations]
    end

    subgraph Primary["US-East-1 (Primary)"]
        ALB1[ALB + WAF]
        ECS1[ECS Cluster]
        RDS1[(MongoDB Replica)]
        Redis1[(Redis Primary)]
    end

    subgraph Secondary["US-West-2 (Secondary)"]
        ALB2[ALB + WAF]
        ECS2[ECS Cluster]
        RDS2[(MongoDB Replica)]
        Redis2[(Redis Replica)]
    end

    subgraph Tertiary["EU-West-1 (Tertiary)"]
        ALB3[ALB + WAF]
        ECS3[ECS Cluster]
        RDS3[(MongoDB Replica)]
        Redis3[(Redis Replica)]
    end

    Route53 --> GlobalAccel
    GlobalAccel --> ALB1
    GlobalAccel --> ALB2
    GlobalAccel --> ALB3
    CloudFront --> ALB1
```

### Traffic Routing

**Route53 Failover:**
- **Health checks:** Every 30 seconds
- **Failure threshold:** 3 consecutive failures
- **Failover time:** ~2 minutes
- **Policy:** Failover routing (Primary → Secondary → Tertiary)

**Global Accelerator:**
- **Anycast IPs:** Static IPs routing to nearest healthy region
- **Health checks:** TCP 443 every 30 seconds
- **Traffic dial:** Adjust traffic percentage per region
- **Automatic failover:** Instant rerouting on regional failure

**CloudFront CDN:**
- **Edge Locations:** 400+ worldwide
- **Origin Failover:** Automatic failover to secondary origin
- **Cache TTLs:** Static assets (7 days), API (0 seconds)
- **Lambda@Edge:** Authentication and request routing

### Data Replication

**MongoDB Atlas:**
- **Multi-region clusters:** Primary + 2 replicas across regions
- **Read preference:** Nearest region for low latency
- **Write concern:** Majority (data durability)

**Redis Global Datastore:**
- **Primary:** us-east-1
- **Replicas:** us-west-2, eu-west-1
- **Replication lag:** < 1 second
- **Failover:** Automatic promotion on primary failure

**DynamoDB Global Tables:**
- **Use Case:** Session storage
- **Replication:** Multi-region active-active
- **Consistency:** Eventual consistency
- **Point-in-time recovery:** Enabled

**S3 Cross-Region Replication:**
- **Source:** us-east-1
- **Destinations:** us-west-2, eu-west-1
- **Replication time:** < 15 minutes
- **Use Case:** ALB logs, backups, static assets

### High Availability Features

**Multi-AZ Deployment:**
- VPC spans 3 availability zones per region
- Services deployed across all AZs
- NAT Gateways in each AZ for redundancy

**Load Balancer Health Checks:**
- **Interval:** 30 seconds
- **Timeout:** 5 seconds
- **Healthy threshold:** 2 consecutive checks
- **Unhealthy threshold:** 3 consecutive checks
- **Path:** `/health` endpoint

**Circuit Breakers (Istio):**
- **Consecutive errors:** 5 failures → eject host
- **Ejection time:** 30 seconds
- **Max ejection percentage:** 50%
- **Min healthy percentage:** 40%

---

## Security & Compliance

### Authentication & Authorization

**JWT-Based Authentication:**
- **Algorithm:** HS256 (HMAC with SHA-256)
- **Token expiry:** 24 hours
- **Refresh tokens:** 7 days
- **Middleware:** `auth.middleware.ts`

**Protected Routes:**
- Comments CRUD
- Favorites management
- Ratings submission
- User profile updates

**Public Routes:**
- Article list/detail
- AI chat (rate-limited)
- Health checks

### Secrets Management

**AWS SSM Parameter Store:**
- **Encryption:** KMS-encrypted (AES-256)
- **Access Control:** IAM roles with least privilege
- **Rotation:** Quarterly manual rotation (automated rotation planned)
- **Audit:** CloudTrail logs all access

**Kubernetes Secrets:**
- **Type:** Opaque secrets
- **Alternative:** External Secrets Operator (sync from SSM/Secrets Manager)
- **Access:** RBAC policies per namespace

**Environment Variables:**
- **Frontend:** Only `NEXT_PUBLIC_*` exposed to client
- **Backend/Crawler:** All secrets server-only
- **Never commit:** `.env` files in `.gitignore`

### Network Security

**VPC Configuration:**
- **CIDR:** 10.0.0.0/16 (us-east-1), 10.1.0.0/16 (us-west-2), 10.2.0.0/16 (eu-west-1)
- **Public Subnets:** ALB, NAT Gateways
- **Private Subnets:** ECS tasks, databases
- **Security Groups:**
  - ALB: Allow 80, 443 from internet
  - ECS Tasks: Allow traffic from ALB only
  - Egress: Allow all (for API calls)

**TLS/SSL:**
- **ALB:** ACM certificate for HTTPS termination
- **Istio Gateway:** TLS termination at ingress
- **Backend to MongoDB:** TLS enabled
- **Backend to Redis:** TLS in-transit encryption
- **Minimum TLS Version:** TLSv1.2

**AWS WAF:**
- **Rate limiting:** 2000 requests per 5 min per IP
- **Geo-blocking:** (Optional) Restrict to specific countries
- **SQL injection protection:** AWS Managed Rules
- **XSS protection:** AWS Managed Rules
- **Bot detection:** AWS Bot Control

### Compliance & Auditing

**CloudTrail:**
- **All API calls logged**
- **S3 storage:** 90-day retention
- **Log validation:** Integrity checking enabled

**VPC Flow Logs:**
- **Network traffic monitoring**
- **Anomaly detection**
- **Security incident investigation**

**Container Scanning:**
- **Snyk:** Dependency vulnerability scanning
- **Trivy:** Container image scanning
- **CI/CD Integration:** Fail builds on critical vulnerabilities

**Data Protection:**
- **At-rest encryption:** MongoDB Atlas, S3, EBS volumes
- **In-transit encryption:** TLS everywhere
- **PII handling:** Emails and auth tokens only, avoid logging sensitive data
- **GDPR compliance:** User data deletion via `/api/users/:id` (admin)

---

## Disaster Recovery & Business Continuity

### Backup Strategy

**MongoDB Atlas:**
- **Automated backups:** Daily snapshots
- **Retention:** 7 days (configurable)
- **Point-in-time recovery:** Restore to any second within retention
- **Cross-region backup:** Snapshots replicated to us-west-2

**S3 Backups:**
- **ALB logs:** 90-day retention, lifecycle policy to Glacier
- **Application backups:** Manual exports to S3
- **Versioning:** Enabled on critical buckets

**Docker Images:**
- **Registry:** GitHub Container Registry (GHCR)
- **Retention:** All tagged versions retained
- **Multi-region:** Replicate to multiple regions

**Infrastructure as Code:**
- **Git repository:** GitHub (private)
- **Terraform state:** S3 backend with versioning + DynamoDB locking
- **Configuration:** All infra reproducible from code

### Recovery Procedures

#### Single Service Failure

**RTO:** 2 minutes
**RPO:** 0 (no data loss)

**Procedure:**
1. Auto-scaling launches replacement tasks
2. Load balancer routes traffic to healthy instances
3. Failed tasks automatically terminated

#### Deployment Rollback

**RTO:** 5 minutes (blue/green), 2 minutes (canary abort)
**RPO:** 0

**Procedure - Blue/Green:**
```bash
cd infrastructure
make aws-rollback-backend
# Instantly switches traffic back to blue environment
```

**Procedure - Canary:**
```bash
make k8s-abort SERVICE=backend
# Immediately reverts all traffic to stable version
```

#### Availability Zone Failure

**RTO:** 5 minutes
**RPO:** 0

**Procedure:**
1. Health checks detect AZ failure
2. Load balancer stops routing to failed AZ
3. Auto-scaling launches tasks in healthy AZs
4. No manual intervention required

#### Region Failure

**RTO:** 15 minutes
**RPO:** 5 minutes (replication lag)

**Procedure:**
```bash
# Initiate failover to secondary region
./infrastructure/scripts/failover.sh us-west-2

# Verify services
curl https://api.example.com/health

# Monitor metrics in secondary region
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name TargetResponseTime \
  --region us-west-2

# Failback when primary region recovered
./infrastructure/scripts/failover.sh us-east-1
```

#### Database Corruption

**RTO:** 1 hour
**RPO:** 1 hour (last snapshot)

**Procedure:**
1. Identify corruption time
2. Restore from MongoDB Atlas snapshot
3. Verify data integrity
4. Resume application traffic

### Recovery Time Objectives

| Scenario | RTO | RPO | Strategy |
|----------|-----|-----|----------|
| Single task failure | 2 min | 0 | Auto-scaling + health checks |
| Deployment rollback (blue/green) | 5 min | 0 | CodeDeploy instant switch |
| Canary abort | 2 min | 0 | Automatic traffic revert |
| AZ failure | 5 min | 0 | Multi-AZ with auto-failover |
| Region failure | 15 min | 5 min | Multi-region with Route53 |
| Database corruption | 1 hour | 1 hour | Point-in-time recovery |
| Complete infrastructure loss | 4 hours | 1 hour | Terraform rebuild + data restore |

---

## Configuration Management

### Environment Variables

**Backend/Crawler/Newsletter:**

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `MONGODB_URI` | Yes | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/db` |
| `GOOGLE_AI_API_KEY` | Yes | Primary Gemini API key | `AIza...` |
| `GOOGLE_AI_API_KEY1-3` | No | Backup API keys for rotation | `AIza...` |
| `PINECONE_API_KEY` | Yes | Pinecone vector DB key | `pc-...` |
| `PINECONE_INDEX` | Yes | Pinecone index name | `ai-gov-articles` |
| `RESEND_API_KEY` | Yes (newsletter) | Email delivery API key | `re_...` |
| `NEWS_API_KEY` | Yes (crawler) | News API key | `...` |
| `JWT_SECRET` | Yes (backend) | JWT signing secret | `random-256-bit-string` |
| `REDIS_URL` | No | Redis connection URL | `redis://...` |

**Frontend:**

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API base URL | `https://api.example.com` |

### Environment Profiles

| Environment | URL Examples | Secrets Location | Notes |
|-------------|-------------|------------------|-------|
| **Local Dev** | `http://localhost:3000-3003` | `.env.local` per service | Docker Compose optional |
| **Staging** | `https://staging-*.vercel.app` | Vercel env vars | Separate MongoDB/Pinecone namespaces |
| **Production** | `https://synthoraai.vercel.app` | AWS SSM / Vercel env | Multi-region deployment |

### Terraform Variables

**File:** `infrastructure/terraform/variables.tf`

**Key Variables:**
- `environment` - Environment name (dev, staging, prod)
- `aws_region` - Primary AWS region
- `vpc_cidr` - VPC CIDR block
- `availability_zones` - AZs for multi-AZ deployment
- `backend_image`, `frontend_image` - Docker image URIs
- `backend_cpu`, `backend_memory` - Task resource limits
- `enable_waf` - Enable AWS WAF
- `enable_fargate_spot` - Use Fargate Spot for cost savings
- `certificate_arn` - ACM certificate for HTTPS

---

## Data Models & Storage

### MongoDB Collections

**Articles (`article.model.ts`):**
```typescript
{
  _id: ObjectId,
  url: string (unique),
  title: string,
  content: string,
  summary: string (AI-generated),
  topics: string[],
  source: string,
  publishedDate: Date,
  createdAt: Date,
  updatedAt: Date,
  ratings: { bias: number, accuracy: number },
  engagement: { views: number, shares: number }
}
```

**Users (`user.model.ts`):**
```typescript
{
  _id: ObjectId,
  email: string (unique),
  passwordHash: string,
  role: 'user' | 'admin',
  favorites: ObjectId[] (article refs),
  createdAt: Date,
  lastLogin: Date
}
```

**Comments (`comment.model.ts`):**
```typescript
{
  _id: ObjectId,
  articleId: ObjectId,
  userId: ObjectId,
  content: string,
  parentId: ObjectId (for threading),
  flagged: boolean,
  createdAt: Date
}
```

**Ratings (`rating.model.ts`):**
```typescript
{
  _id: ObjectId,
  articleId: ObjectId,
  userId: ObjectId,
  bias: number (1-5),
  accuracy: number (1-5),
  createdAt: Date
}
```

**Chat Sessions (`chatSession.ts`):**
```typescript
{
  _id: ObjectId,
  userId: ObjectId,
  conversationId: string,
  messages: [{
    role: 'user' | 'assistant',
    content: string,
    timestamp: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
```

**Newsletter Subscribers (`newsletterSubscriber.model.ts`):**
```typescript
{
  _id: ObjectId,
  email: string (unique),
  subscribed: boolean,
  unsubscribeToken: string,
  subscribedAt: Date,
  unsubscribedAt: Date
}
```

### Pinecone Vector Index

**Index:** `ai-gov-articles`

**Dimensions:** 768 (text-embedding-004)

**Metadata:**
```typescript
{
  id: string (article MongoDB _id),
  title: string,
  url: string,
  summary: string,
  topics: string[],
  publishedDate: string
}
```

**Queries:**
- Semantic search for sitewide chat
- Related articles recommendation
- Topic clustering

### Redis Cache Schema

**Keys:**
- `article:list:{filter}:{page}` - Paginated article lists (TTL: 1 hour)
- `article:detail:{id}` - Article detail (TTL: 30 min)
- `user:session:{token}` - User sessions (TTL: 24 hours)
- `cache:embedding:{hash}` - Cached embeddings (TTL: 7 days)

---

## Operational Runbooks

### Health Checks

**Endpoints:**
- Backend: `GET /health`, `/api/health`
- Frontend: `GET /api/health`
- Crawler: `GET /api/health`
- Newsletter: `GET /api/health`

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T12:00:00Z",
  "version": "1.2.3",
  "services": {
    "mongodb": "connected",
    "redis": "connected",
    "pinecone": "connected"
  }
}
```

### Common Operations

#### Deploy New Version

**AWS ECS (Blue/Green):**
```bash
cd infrastructure

# Update Terraform with new image tag
terraform apply -var="backend_image=ghcr.io/hoangsonww/ai-curator-backend:v1.2.3"

# Deploy with CodeDeploy
make aws-deploy-backend ENVIRONMENT=prod
```

**Kubernetes (Canary):**
```bash
cd infrastructure

# Update image in deployment manifest
# Then deploy
make k8s-deploy SERVICE=backend IMAGE_TAG=v1.2.3

# Monitor rollout
kubectl argo rollouts get rollout backend -n ai-curator --watch

# Promote when ready
make k8s-promote SERVICE=backend
```

#### Scale Services Manually

**AWS ECS:**
```bash
aws ecs update-service \
  --cluster ai-curator-prod \
  --service ai-curator-prod-backend \
  --desired-count 10
```

**Kubernetes:**
```bash
kubectl scale rollout backend -n ai-curator --replicas=10
```

#### Rotate Secrets

**Update SSM Parameter:**
```bash
aws ssm put-parameter \
  --name "/ai-curator/prod/google-ai-key" \
  --value "new-api-key" \
  --type "SecureString" \
  --overwrite

# Force ECS deployment to pick up new value
make aws-deploy-backend
```

**Update Kubernetes Secret:**
```bash
kubectl create secret generic backend-secrets \
  --from-literal=GOOGLE_AI_API_KEY=new-key \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart pods
kubectl rollout restart rollout backend -n ai-curator
```

#### View Logs

**AWS ECS:**
```bash
# Via CloudWatch Logs Insights
aws logs tail /ecs/ai-curator-prod-backend --follow

# Via AWS Console
aws logs get-log-events \
  --log-group-name /ecs/ai-curator-prod-backend \
  --log-stream-name <stream-name>
```

**Kubernetes:**
```bash
# Single pod
kubectl logs -f backend-abc123 -n ai-curator

# All pods with label
kubectl logs -f -l app=backend -n ai-curator --tail=100

# Previous container (crashed pods)
kubectl logs backend-abc123 -n ai-curator --previous
```

#### Debugging Production Issues

**Check Service Health:**
```bash
# AWS ECS
aws ecs describe-services \
  --cluster ai-curator-prod \
  --services ai-curator-prod-backend

# Kubernetes
kubectl describe rollout backend -n ai-curator
kubectl get events -n ai-curator --sort-by='.lastTimestamp'
```

**Check Resource Usage:**
```bash
# Kubernetes
kubectl top pods -n ai-curator
kubectl top nodes

# AWS ECS (via CloudWatch)
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=ai-curator-prod-backend \
  --start-time 2025-01-15T00:00:00Z \
  --end-time 2025-01-15T12:00:00Z \
  --period 300 \
  --statistics Average
```

**Database Connectivity:**
```bash
# Test MongoDB connection
kubectl run -i --tty --rm debug \
  --image=mongo:latest \
  --restart=Never \
  -- mongosh "mongodb+srv://..."

# Test Redis connection
kubectl run -i --tty --rm debug \
  --image=redis:latest \
  --restart=Never \
  -- redis-cli -h <redis-host> ping
```

### Disaster Recovery Drills

**Quarterly Checklist:**
1. [ ] Test region failover (Primary → Secondary)
2. [ ] Restore database from backup
3. [ ] Rebuild infrastructure from Terraform
4. [ ] Verify all secrets in SSM/Secrets Manager
5. [ ] Test blue/green rollback
6. [ ] Test canary abort
7. [ ] Validate monitoring alerts
8. [ ] Review and update runbooks

---

## Build & Deployment Workflow

```mermaid
flowchart LR
    Commit["git commit<br/>+ push"] --> CI["CI Pipelines<br/>(Husky + lint/test)"]
    CI --> BuildFE["Build Frontend<br/>npm run build"]
    CI --> BuildBE["Build Backend<br/>npm run build"]
    CI --> BuildCrawler["Build Crawler<br/>npm run build"]
    CI --> BuildNL["Build Newsletter<br/>npm run build"]
    BuildFE --> DockerFE["Docker Build<br/>Frontend Image"]
    BuildBE --> DockerBE["Docker Build<br/>Backend Image"]
    BuildCrawler --> DockerCrawler["Docker Build<br/>Crawler Image"]
    BuildNL --> DockerNL["Docker Build<br/>Newsletter Image"]
    DockerFE --> Registry["Push to GHCR<br/>Container Registry"]
    DockerBE --> Registry
    DockerCrawler --> Registry
    DockerNL --> Registry
    Registry --> DeployVercel["Deploy to Vercel<br/>(Optional)"]
    Registry --> DeployAWS["Deploy to AWS ECS<br/>(Blue/Green)"]
    Registry --> DeployK8s["Deploy to Kubernetes<br/>(Canary)"]
    DeployAWS --> Validate["Health Checks<br/>+ Smoke Tests"]
    DeployK8s --> Validate
    Validate --> Notify["Slack Notifications"]
```

---

## Performance, Caching & Resilience

**Caching Layers:**
1. **Redis:** Hot article lists (1 hour TTL), article details (30 min TTL)
2. **Pinecone Embeddings:** Process-level cache for repeated queries
3. **MongoDB Indexes:** `_id`, `createdAt`, `topics`, `articleId`
4. **CloudFront CDN:** Static assets (7 days), API responses (configurable)

**Streaming:**
- **SSE for sitewide chat:** Minimizes perceived latency, bounded memory usage

**Rate Limiting & Quota Protection:**
- **Multiple Gemini API keys:** Rotation on 429 errors
- **Model failover:** gemini-2.0-flash-exp → gemini-2.0-flash-lite → gemini-1.5-flash
- **History compaction:** `MAX_HISTORY_MESSAGES`, `MAX_PROMPT_CHARS`
- **Retry with backoff:** Exponential backoff for transient failures

**Fallback Paths:**
- **Article Q&A:** Works without Pinecone, uses article content directly
- **Sitewide chat:** Falls back to minimal context if Pinecone unavailable
- **Redis failure:** API falls back to MongoDB (higher latency but functional)

---

## Networking & Access Control

```mermaid
flowchart LR
    Internet["Public Internet"] --> Edge["Vercel Edge / CloudFront<br/>TLS Termination + CDN"]
    Edge --> WAF["AWS WAF<br/>DDoS Protection<br/>Rate Limiting"]
    WAF --> LB["ALB / Istio Gateway<br/>Load Balancing"]
    LB --> App["Backend API<br/>Frontend App"]
    App --> MongoDB[(MongoDB Atlas<br/>IP Allowlist / VPC Peering)]
    App --> Pinecone[(Pinecone<br/>API Key Auth)]
    App --> Redis[(Redis<br/>TLS Encryption)]
    App --> Resend[(Resend API<br/>API Key Auth)]
    App --> GoogleAI[(Google Generative AI<br/>API Key Auth)]
```

**Best Practices:**
- **HTTPS Everywhere:** TLS 1.2+ for all external traffic
- **HSTS:** Recommended at domain level
- **MongoDB Atlas:** IP allowlist or VPC peering, never public internet
- **API Keys:** Server-side only, never in client bundles
- **Frontend:** Only `NEXT_PUBLIC_*` variables exposed

---

## Reliability & Failure Modes

**Chat Failover:**
- Multiple Gemini API keys with automatic rotation
- Model fallback chain
- Retry with exponential backoff
- History compaction to avoid token overruns
- Graceful degradation to minimal context

**Crawler Resilience:**
- Axios + Cheerio with Puppeteer fallback for JS-rendered pages
- Dedupe checks before fetching
- Retry envelopes with timeout guards
- Cleanup scripts to prevent index drift

**Cache Fallback:**
- Redis unavailable → query MongoDB directly
- Increased latency but maintains functionality

**Vector Sync:**
- Embeddings upserted after article summarization
- `deleteArticleVector()` on article deletion
- Periodic reconciliation job (planned)

**Newsletter Safety:**
- Digest depends on backend API availability
- Failures logged to CloudWatch/stdout
- Manual re-run via `daily.sh` or cron

---

## Automation & Tooling

```mermaid
flowchart LR
    Devs["Developers"] --> Make["Makefile Targets<br/>(make dev-*, make build-*)"]
    Devs --> Shell["Shell Scripts<br/>(shell/*.sh)"]
    Make --> ServicesCluster["Local Docker Compose<br/>OR<br/>pnpm dev servers"]
    Shell --> CronLocal["Local Cron Jobs<br/>(daily.sh)"]
    Shell --> CI["CI Pipelines<br/>(GitHub Actions, CircleCI, Jenkins)"]
    CronLocal --> ServicesCluster
    VercelCron["Vercel Cron"] --> CloudServices["Crawler / Backend / Newsletter<br/>(Serverless)"]
    EventBridge["AWS EventBridge"] --> ECS["ECS Scheduled Tasks"]
    K8sCron["Kubernetes CronJobs"] --> K8sJobs["Crawler / Newsletter Jobs"]
```

**Unified Entrypoints:**
- `bootstrap.sh` - Initial project setup
- `dev-*.sh` - Start development servers per service
- `build-*.sh` - Build production bundles
- `start-*.sh` - Start production servers
- `daily.sh` - Automated daily crawl + newsletter

**Management Utilities:**
- `shell/management.js` - Node-based orchestration helpers
- `shell/utils.js` - Shared utilities for scripting
- `bin/aicc` - CLI tool for repo-wide operations

---

## Storage, Indexing & Scaling Notes

**MongoDB Atlas:**
- Primary store for all structured data
- Indexes: `_id`, `createdAt`, `topics`, `articleId`
- Multi-region replica sets for HA

**Pinecone:**
- `ai-gov-articles` index for semantic search
- 768-dimensional vectors (text-embedding-004)
- TopK=5 for low latency

**Redis:**
- Hot data caching to reduce MongoDB load
- In-memory, sub-millisecond latency

**Scaling Levers:**
- **Vercel:** Automatic function concurrency scaling
- **AWS ECS:** Auto-scaling policies (CPU, memory, request count)
- **Kubernetes:** HPA + VPA + cluster autoscaler
- **Pinecone:** Increase topK or use namespaces for isolation
- **Redis:** Enable TTLs, increase memory, use clustering

**Limits & Budgets:**
- `MAX_HISTORY_MESSAGES` - Chat history cap
- `MAX_PROMPT_CHARS` - Prompt length limit
- `MAX_ARTICLE_SNIPPET_CHARS` - Snippet truncation
- SSE streaming to avoid large payloads

---

## References & Further Reading

- **Project README:** [README.md](README.md)
- **Deployment Guide:** [infrastructure/DEPLOYMENT.md](infrastructure/DEPLOYMENT.md)
- **Infrastructure README:** [infrastructure/README.md](infrastructure/README.md)
- **Agentic AI Pipeline:** [agentic_ai/README.md](agentic_ai/README.md)
- **RAG Chatbot Details:** [RAG_CHATBOT.md](RAG_CHATBOT.md)
- **Citation & Guardrails:** [CITATION_AND_GUARDRAILS.md](CITATION_AND_GUARDRAILS.md)
- **Terraform AWS Provider:** https://registry.terraform.io/providers/hashicorp/aws/latest/docs
- **Argo Rollouts:** https://argoproj.github.io/argo-rollouts/
- **Istio:** https://istio.io/latest/docs/
- **AWS ECS Best Practices:** https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/
- **Kubernetes Best Practices:** https://kubernetes.io/docs/concepts/configuration/overview/
- **License:** MIT License (see [LICENSE](LICENSE) file)

---

**For additional support, consult the individual service READMEs and inline documentation within each module. This architecture document is a living document and will be updated as the system evolves.**
