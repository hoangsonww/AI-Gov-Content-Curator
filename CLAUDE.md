# SynthoraAI Claude Code Memory

This repository is a monorepo for an AI-assisted government article curation platform.
The main services are:

- `backend/`: Express + TypeScript API, MongoDB, JWT auth, Gemini, Pinecone.
- `frontend/`: Next.js Pages Router app for article browsing, auth UX, comments, ratings, and chat.
- `crawler/`: scheduled ingestion pipeline using Axios/Cheerio/Puppeteer, Gemini, MongoDB, Pinecone.
- `newsletters/`: scheduled Resend-based digest sender backed by MongoDB.
- `agentic_ai/`: Python LangGraph pipeline plus a local MCP server.
- `infrastructure/`: Terraform, Kubernetes, monitoring, and deployment wrappers.
- `shell/` and `bin/`: developer wrappers; useful, but some scripts have drift.

## How To Work In This Repo

- Prefer the real workspace source over generated output. Do not edit `node_modules/`, `.next/`, `coverage/`, `dist/`, `.vercel/`, `test-results/`, or checked-in `.DS_Store` files.
- Prefer TypeScript source over checked-in compiled JavaScript. In `crawler/`, the `.ts` files are the source of truth even when `.js` siblings exist.
- Prefer the root `package.json` scripts, workspace `package.json` scripts, and `bin/aicc.js` over older `shell/` wrappers when both exist.
- Treat README files as helpful but not fully authoritative. Check current code, `package.json`, `vercel.json`, Dockerfiles, and actual routes before making assumptions.
- Be careful with live-side effects. The crawler can hit external sites and APIs. The newsletter job can send email and mutate subscriber state. Cleanup scripts delete or rewrite records.
- Security-sensitive areas need extra review: `backend/src/controllers/auth.controller.ts`, auth middleware, password reset flows, newsletter unsubscribe logic, and infra secrets.

## Canonical Commands

Root:

- `npm run dev:frontend`
- `npm run dev:backend`
- `npm run dev:crawler`
- `npm run lint`
- `node bin/aicc.js --help`

Backend:

- `cd backend && npm run dev`
- `cd backend && npm test`
- `cd backend && npm run test:coverage`
- `cd backend && npm run prune-articles`
- `cd backend && npm run sync-pinecone`

Frontend:

- `cd frontend && npm run dev`
- `cd frontend && npm run lint`
- `cd frontend && npm run test:e2e`

Crawler:

- `cd crawler && npm run dev`
- `cd crawler && npm test`
- `cd crawler && npm run crawl`
- `cd crawler && npm run clean:articles`

Newsletters:

- `cd newsletters && npm run dev`
- `cd newsletters && npm test`
- `cd newsletters && npm run newsletter`

Agentic AI:

- `cd agentic_ai && make run-mcp`
- `cd agentic_ai && python -m agentic_ai.mcp_server.server`

Infrastructure:

- `cd infrastructure && make terraform-plan`
- `cd infrastructure && make aws-deploy`
- `cd infrastructure && make k8s-deploy-all`

## Testing Expectations

- Backend changes: run the backend Jest suite that matches the touched surface. If auth, controllers, scripts, or persistence changed, prefer `cd backend && npm test`.
- Frontend changes: run `cd frontend && npm run lint` for UI/data-flow changes; run Playwright for route or interaction changes.
- Crawler changes: run crawler Jest tests before any live crawl command.
- Newsletter changes: run the newsletter test suite before any live send command.
- Infra or docs-only changes: no blanket test requirement, but verify referenced paths and commands still exist.

## Known Drift And Fragile Areas

- `backend` and `crawler` each have doc and runtime drift around scheduled handlers, Docker, and build behavior.
- `frontend` mixes hard-coded backend URLs and `NEXT_PUBLIC_API_URL`.
- `frontend` relies heavily on browser-only APIs such as `localStorage`, cookies, and `window`.
- `newsletters/Dockerfile` appears to assume compiled output that `next build` does not produce.
- `agentic_ai` looks partly scaffolded; some Make targets and health-check assumptions do not match the current implementation.
- `shell/` scripts are not always path-safe from the repo root despite what the docs say.

## Files Worth Reading Before Risky Changes

- `README.md`
- `ARCHITECTURE.md`
- `RAG_CHATBOT.md`
- `CHATBOT_GUARDRAILS.md`
- `backend/README.md`
- `frontend/README.md`
- `crawler/README.md`
- `newsletters/README.md`
- `agentic_ai/README.md`
- `infrastructure/README.md`
- `infrastructure/DEPLOYMENT.md`

## Claude Code Extension Layout In This Repo

- Project memory: this file plus nested `CLAUDE.md` files inside major services.
- Skills: `.claude/skills/`
- Subagents: `.claude/agents/`
- Hooks: `.claude/hooks/` wired via `.claude/settings.json`
- MCP config: `.mcp.json`

Use the nested `CLAUDE.md` files when you move into a service. Use the project skills when the task matches a workflow or domain. Use the custom subagents when you need isolated review or focused research.

The project MCP config points at `agentic_ai.mcp_server.server` and assumes the Python dependencies from `agentic_ai/requirements.txt` are installed in the active environment.
