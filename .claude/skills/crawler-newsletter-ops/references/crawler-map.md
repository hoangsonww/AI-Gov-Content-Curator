# Crawler Map

## Source Of Truth

- `crawler/schedule/fetchAndSummarize.ts`
- `crawler/services/`
- `crawler/scripts/`
- `crawler/models/article.model.ts`
- `crawler/vercel.json`

## Commands

- `npm run dev`
- `npm test`
- `npm run crawl`
- `npm run fetch:past`
- `npm run fetch:latest`
- `npm run clean:articles`

## Important Env

- `MONGODB_URI`
- `CRAWL_URLS`
- crawl concurrency and timeout vars
- `GOOGLE_AI_API_KEY` variants
- `NEWS_API_KEY` variants
- `PINECONE_API_KEY`
- `PINECONE_INDEX`

## Known Drift

- cleanup route references a missing `cleanArticles.ts` file while the actual script is `scripts/cleanData.ts`
- docs are less reliable than `vercel.json` and package scripts
