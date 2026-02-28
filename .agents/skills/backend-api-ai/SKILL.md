---
name: backend-api-ai
description: Change or review the backend API, auth, controllers, models, sitewide chat backend, Gemini integration, Pinecone integration, or backend maintenance scripts in this repository. Use when work touches backend/ routes, controllers, services, models, scheduled handlers, or vector sync logic.
---

# Backend API And AI

Work from route to controller to service to model before changing behavior.

## Follow This Workflow

1. Identify the request surface in `routes/` or scheduled handlers.
2. Read the controller, service, and model together.
3. Preserve response shapes unless the frontend is updated in the same task.
4. Treat auth and reset-password flows as security-sensitive.
5. Validate with `cd backend && npm test` when feasible.

## Use The References

- Read `references/backend-map.md` for key files, commands, and env.
- Read `references/chat-surface.md` when the task touches sitewide chat.
