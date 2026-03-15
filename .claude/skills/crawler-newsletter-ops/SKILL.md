---
name: crawler-newsletter-ops
description: Use this skill when changing the crawler or newsletter scheduled jobs in this repository, including cron routes, cleanup scripts, article ingestion, summarization, digest generation, or operational safeguards around live jobs.
---

# Crawler And Newsletter Ops

This skill covers `crawler/` and `newsletters/`.

## Working Rules

- Treat both services as production jobs with real side effects.
- Do not trust README timing or script names without checking `vercel.json`, `package.json`, and the code.
- In `crawler/`, edit `.ts` source rather than checked-in `.js` duplicates.
- Before changing cleanup behavior, read the end-to-end job flow.
- Before changing newsletter send logic, note that it mutates subscriber send state and may trigger article cleanup.

## Validation

- Prefer tests before live commands.
- Only run crawl or newsletter commands when the task clearly requires it and env is known safe.

## References

- For crawler specifics, read `references/crawler-map.md`.
- For newsletter specifics, read `references/newsletter-map.md`.
