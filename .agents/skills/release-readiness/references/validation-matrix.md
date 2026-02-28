# Validation Matrix

- `backend/`: `cd backend && npm test`
- `frontend/`: `cd frontend && npm run lint`; add Playwright for route and interaction changes
- `crawler/`: `cd crawler && npm test`
- `newsletters/`: `cd newsletters && npm test`
- `agentic_ai/`: consistency review first
- `infrastructure/`: consistency review first

Add manual risk notes when the change touches live crawler/newsletter flows, auth, or deploy logic.
