# Crawler Guidance

- Edit TypeScript source in `schedule/`, `services/`, `scripts/`, and `models/`; do not prefer the checked-in `.js` copies.
- Treat crawl, cleanup, and summarization changes as production-sensitive. They affect quotas, latency, and stored article state.
- Verify schedule and route behavior against `vercel.json` and the current route files, not README prose alone.
- Run `npm test` before live crawl or cleanup commands when feasible.
