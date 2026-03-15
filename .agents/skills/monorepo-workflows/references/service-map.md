# Service Map

- `backend/`: API, auth, comments, ratings, bias analysis, sitewide chat backend, vector search
- `frontend/`: Pages Router UI, auth UX, article browsing, article detail flows, sitewide chat UI
- `crawler/`: scraping, summarization, topic extraction, MongoDB writes, Pinecone upserts
- `newsletters/`: scheduled digest sending and subscriber send state
- `agentic_ai/`: Python LangGraph pipeline and MCP server
- `infrastructure/`: Terraform, Kubernetes, monitoring, rollout logic
- `shell/`: convenience wrappers with path drift
- `bin/`: repo CLI with the cleanest common workspace wrappers

## Canonical Commands

- Root: `npm run dev:frontend`, `npm run dev:backend`, `npm run dev:crawler`, `npm run lint`
- Backend: `cd backend && npm run dev`, `npm test`
- Frontend: `cd frontend && npm run dev`, `npm run lint`, `npm run test:e2e`
- Crawler: `cd crawler && npm run dev`, `npm test`, `npm run crawl`
- Newsletters: `cd newsletters && npm run dev`, `npm test`, `npm run newsletter`
- Agentic AI: `cd agentic_ai && make run-mcp`
- Infrastructure: `cd infrastructure && make terraform-plan`

## Known Drift

- `frontend/` mixes hard-coded and env-driven API base configuration
- `crawler/` has `.ts` and checked-in `.js` siblings
- `newsletters/Dockerfile` assumes a compiled `dist/` path
- `shell/` scripts often use `cd ../...`
