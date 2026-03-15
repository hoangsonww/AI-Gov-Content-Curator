# Backend Map

## High-Value Files

- `backend/src/app.ts`
- `backend/src/server.ts`
- `backend/src/routes/`
- `backend/src/controllers/`
- `backend/src/services/`
- `backend/src/models/`
- `backend/src/middleware/`
- `backend/src/scripts/`
- `backend/src/schedule/`
- `backend/src/pages/api/scheduled/`
- `backend/src/api/scheduled/`

## Commands

- `npm run dev`
- `npm test`
- `npm run test:coverage`
- `npm run prune-articles`
- `npm run sync-pinecone`
- `npm run sync-missing-vectors`

## Important Env

- `MONGODB_URI`
- `JWT_SECRET`
- `GOOGLE_AI_API_KEY` and rotated variants
- `NEWS_API_KEY` and rotated variants
- `PINECONE_API_KEY`
- `PINECONE_INDEX`
- `REDIS_URL`

## Known Fragility

- `build` tolerates TypeScript errors
- Docker and package runtime assumptions do not fully align
- some docs still describe Next.js-style behavior more than the current Express-first runtime
- auth has sensitive fallbacks and reset-password logic
- duplicate scheduled handler paths exist
