# Backend Map

## Key Files

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

- build and runtime assumptions do not fully align
- duplicate scheduled handler paths exist
- auth and reset-password paths are sensitive
