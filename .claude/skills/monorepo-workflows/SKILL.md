---
name: monorepo-workflows
description: Use this skill when working anywhere in the SynthoraAI monorepo and you need the repository-specific operating model: which service owns what, which commands are canonical, which wrappers are stale, how to choose tests, and which paths are generated or risky to edit.
---

# Monorepo Workflows

Use this skill before broad repo changes, multi-service tasks, or when routing a task to the correct service.

## Primary Rules

- Choose the service first, then the command surface.
- Prefer root and workspace `package.json` scripts plus `bin/aicc.js`.
- Treat `shell/` as convenience tooling with some path drift; verify before relying on it.
- Do not edit generated output or local-only secret files.
- Read nested `CLAUDE.md` files as you move into a service directory.

## Service Routing

- API, auth, articles, comments, ratings, bias, sitewide chat backend, Pinecone sync: `backend/`
- article browsing UI, auth UX, comments UI, ratings UI, SSE chat UI: `frontend/`
- crawling, summarization, topic extraction, article ingestion jobs: `crawler/`
- daily digest delivery and subscriber mail state: `newsletters/`
- LangGraph pipeline and repo-local MCP server: `agentic_ai/`
- Terraform, Kubernetes, monitoring, deploy wrappers: `infrastructure/`

## Workflow

1. Identify the owning service and read its local `CLAUDE.md`.
2. Confirm the current script or runtime entrypoint from `package.json`, `vercel.json`, Dockerfiles, or Makefiles.
3. Check whether the task has live side effects.
4. Make the smallest coherent change in source files, not generated output.
5. Run the narrowest useful validation for the touched area.

## References

- For canonical commands and repo drift, read `references/commands-and-risks.md`.
- For documentation entry points, read `references/docs-map.md`.
