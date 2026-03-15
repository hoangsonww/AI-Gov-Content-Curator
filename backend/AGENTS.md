# Backend Guidance

- Work in `src/routes/`, `src/controllers/`, `src/services/`, `src/models/`, and `src/middleware/` for most behavior changes.
- Treat auth, password reset, JWT handling, and scheduled ingestion as security- or operations-sensitive.
- Preserve API response shapes unless the frontend is updated in the same task.
- Check runtime wiring carefully when touching `src/app.ts`, `src/server.ts`, scheduled handlers, Dockerfiles, or build assumptions.
- Run `npm test` for behavior changes when feasible.
