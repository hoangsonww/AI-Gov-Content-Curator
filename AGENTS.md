# Codex Guidance

## Repository Expectations

- Work from source files, not generated output. Do not edit `node_modules/`, `.next/`, `coverage/`, `dist/`, `.vercel/`, `test-results/`, or `.DS_Store`.
- Prefer root and workspace `package.json` scripts plus `bin/aicc.js` over older `shell/` wrappers when both cover the same task.
- Treat README files as helpful context, not the final source of truth. Verify commands and routes against `package.json`, `vercel.json`, Dockerfiles, and implementation files.
- Treat `backend/`, `crawler/`, and `newsletters/` as side-effecting surfaces. Crawls hit external APIs, cleanup scripts mutate stored articles, and newsletter jobs can send real email.
- Check `.agents/skills/` before inventing repo workflow from scratch. The skills are designed around this monorepo’s actual drift points and command surfaces.

## Service Map

- `backend/`: Express + TypeScript API, auth, comments, ratings, bias analysis, sitewide chat backend, Gemini, Pinecone
- `frontend/`: Next.js Pages Router app, auth UX, article browsing, article detail flows, sitewide chat UI
- `crawler/`: scheduled ingestion, scraping, summarization, topic extraction, MongoDB upserts, Pinecone sync
- `newsletters/`: scheduled daily digest sender using Resend
- `agentic_ai/`: Python LangGraph pipeline and local MCP server
- `infrastructure/`: Terraform, Kubernetes, monitoring, rollout config
- `shell/` and `bin/`: developer wrappers and CLI

## Validation Defaults

- `backend/`: `cd backend && npm test`
- `frontend/`: `cd frontend && npm run lint`; add Playwright when route or interaction behavior changes
- `crawler/`: `cd crawler && npm test`
- `newsletters/`: `cd newsletters && npm test`
- `agentic_ai/`: review consistency first; only run Python commands when dependencies are known installed
- `infrastructure/`: review manifest/script consistency first; only run apply/deploy commands in an explicitly prepared environment

## Known Repo Drift

- `frontend/` mixes a hard-coded backend base URL with `NEXT_PUBLIC_API_URL`
- `crawler/` has checked-in `.js` siblings beside `.ts` source; prefer `.ts`
- `crawler/pages/api/scheduled/cleanArticles.ts` points at a missing `scripts/cleanArticles.ts`
- `newsletters/Dockerfile` assumes built `dist/` output that the current build does not generate
- `shell/` scripts often use `cd ../...` despite the docs saying to run them from repo root

## Codex Extensions In This Repo

- Skills: `.agents/skills/`
- Repo rules: `codex/rules/repo.rules`
- Nested overrides: per-directory `AGENTS.md` files

Read the nearest `AGENTS.md` for service-specific guidance before making changes in that directory.
