---
name: jobs-ops
description: Change or review the crawler and newsletter job surfaces in this repository. Use when work touches crawler/ or newsletters/, scheduled routes, vercel.json cron definitions, cleanup scripts, article ingestion, summarization, digest generation, or other live operational workflows.
---

# Jobs And Operations

Treat crawler and newsletter work as live operations.

## Follow This Workflow

1. Verify the schedule and route in `vercel.json` and the current route file.
2. Read the job entrypoint plus the cleanup path before changing behavior.
3. Prefer tests before live job execution.
4. Be explicit when a command may crawl external sites, mutate article state, or send email.

## Use The Tools

- Run `python3 scripts/show_schedules.py` to summarize current cron paths and route-file presence.

## Use The References

- Read `references/crawler-map.md` for crawler specifics.
- Read `references/newsletter-map.md` for newsletter specifics.
