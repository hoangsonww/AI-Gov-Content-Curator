---
name: backend-api-ai
description: Use this skill when changing the backend API, controllers, auth, article ingestion, sitewide chat backend, Gemini integration, Pinecone integration, or backend maintenance scripts in this repository.
---

# Backend API And AI

This skill is for `backend/`.

## Focus Areas

- route and controller changes
- auth and user flows
- article CRUD and list/detail responses
- sitewide chat streaming and citation metadata
- maintenance scripts such as pruning and vector sync
- data model changes

## Working Rules

- Read the route, controller, service, and model together before changing behavior.
- Preserve response contracts unless the frontend is updated in the same task.
- Treat auth changes as security changes, not routine refactors.
- Check for build and deploy drift if you change runtime entrypoints or scheduled handlers.
- Prefer explicit env validation over silent fallback behavior.

## Validation

- Run `cd backend && npm test` for behavior changes when feasible.
- If you change scripts, ensure the relevant script still maps to a real file.
- If you change chat behavior, read `RAG_CHATBOT.md` and `CHATBOT_GUARDRAILS.md`.

## References

- For backend commands, env, and fragile files, read `references/backend-map.md`.
- For chat-specific guidance, read `references/chat-surface.md`.
