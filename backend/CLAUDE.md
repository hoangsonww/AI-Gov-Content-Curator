# Backend Memory

Work here when the task touches API routes, controllers, models, auth, scheduled ingestion, chat, bias analysis, comments, ratings, or vector search.

## What Matters

- Main runtime files: `src/app.ts` and `src/server.ts`.
- Primary change surfaces: `src/routes/`, `src/controllers/`, `src/services/`, `src/models/`, `src/middleware/`.
- Scheduled and maintenance work lives under `src/pages/api/scheduled/`, `src/api/scheduled/`, `src/schedule/`, and `src/scripts/`.
- This service uses MongoDB, Gemini, and Pinecone. Treat external API usage and vector sync as cost- and latency-sensitive.

## Guardrails

- Do not weaken auth, passkey, or reset-password flows without explicit justification. Both password and passkey paths funnel through `services/auth-token.service.ts` for JWT issuance — don't reintroduce inline `jwt.sign` in controllers.
- The `User.password` field is OPTIONAL (passkey-only accounts have no password). A pre-save validator requires every user to have at least `password` or `hasPasskeys=true`. Don't remove this validator.
- WebAuthn challenge state lives in the `WebAuthnChallenge` collection with a Mongo TTL index. Don't add ad-hoc challenge storage.
- `RP_ID` MUST equal the frontend apex domain, not the backend's host.
- Preserve API shapes unless the frontend is updated in the same change.
- Prefer schema and controller fixes over ad hoc response reshaping in random files.
- Be aware that build and deploy assumptions are inconsistent here. Check Docker, TypeScript output, and Vercel handlers together when touching runtime wiring.
- If you touch ingestion or vector logic, read the related service and script files first. Hidden coupling is common.

## Useful Commands

- `npm run dev`
- `npm test`
- `npm run test:coverage`
- `npm run prune-articles`
- `npm run sync-pinecone`
- `npm run sync-missing-vectors`
