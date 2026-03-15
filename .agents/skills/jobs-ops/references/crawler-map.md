# Crawler Map

## Source Of Truth

- `crawler/schedule/fetchAndSummarize.ts`
- `crawler/services/`
- `crawler/scripts/`
- `crawler/models/article.model.ts`
- `crawler/vercel.json`

## Commands

- `npm test`
- `npm run crawl`
- `npm run fetch:past`
- `npm run fetch:latest`
- `npm run clean:articles`

## Known Drift

- `crawler/pages/api/scheduled/cleanArticles.ts` points at `scripts/cleanArticles.ts`, but the existing script is `scripts/cleanData.ts`
