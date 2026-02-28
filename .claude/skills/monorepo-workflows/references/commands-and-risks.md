# Commands And Risks

## Root

- `npm run dev:frontend`
- `npm run dev:backend`
- `npm run dev:crawler`
- `npm run lint`
- `node bin/aicc.js --help`

## Backend

- `cd backend && npm run dev`
- `cd backend && npm test`
- `cd backend && npm run prune-articles`
- `cd backend && npm run sync-pinecone`

Risks:

- auth and password reset
- API compatibility with `frontend/`
- Gemini and Pinecone costs
- duplicated scheduled handler paths

## Frontend

- `cd frontend && npm run dev`
- `cd frontend && npm run lint`
- `cd frontend && npm run test:e2e`

Risks:

- browser-only APIs
- query-param and shallow-routing behavior
- hard-coded backend URL drift
- article detail page coupling

## Crawler

- `cd crawler && npm test`
- `cd crawler && npm run crawl`
- `cd crawler && npm run clean:articles`

Risks:

- live network traffic
- external API quotas
- cleanup side effects
- `.ts` versus checked-in `.js` drift

## Newsletters

- `cd newsletters && npm test`
- `cd newsletters && npm run newsletter`

Risks:

- live email send
- subscriber `lastSentAt` mutation
- cleanup runs after send

## Agentic AI

- `cd agentic_ai && make run-mcp`
- `cd agentic_ai && python -m agentic_ai.mcp_server.server`

Risks:

- partial scaffolding
- cloud adapter drift
- Python environment assumptions

## Infrastructure

- `cd infrastructure && make terraform-plan`
- `cd infrastructure && make aws-deploy`
- `cd infrastructure && make k8s-deploy-all`

Risks:

- placeholder secrets
- hard-coded environment assumptions
- `:latest` image drift
- rollout safety
