# Crawler Memory

This service is the scheduled ingestion pipeline.

## What Matters

- Source of truth is the TypeScript code in `schedule/`, `services/`, `scripts/`, and `models/`.
- Checked-in `.js` siblings are not the preferred edit target.
- The pipeline mixes static fetches, dynamic fetch fallback, Gemini summarization/topic extraction, MongoDB writes, and optional Pinecone upserts.

## Guardrails

- Avoid live crawl or cleanup commands unless the user clearly wants them.
- Treat NewsAPI keys, Gemini keys, crawl concurrency, and cleanup scripts as production-sensitive.
- Verify scheduled behavior against `vercel.json` and current route files, not README prose alone.
- If changing fetch fallbacks or dedupe logic, read the whole pipeline first. Small changes can explode runtime or duplicate articles.

## Useful Commands

- `npm run dev`
- `npm test`
- `npm run crawl`
- `npm run fetch:past`
- `npm run fetch:latest`
- `npm run clean:articles`
