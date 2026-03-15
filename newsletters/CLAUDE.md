# Newsletter Memory

This service is a scheduled email sender with a minimal Next.js wrapper.

## What Matters

- Job logic is in `schedule/sendNewsletter.ts`.
- Models are in `models/`.
- Vercel schedule config is in `vercel.json`.
- This job reads shared `Article` data and updates subscriber `lastSentAt`.

## Guardrails

- Assume a live send is a real side effect.
- Do not run the newsletter job casually when real credentials may be loaded.
- Check cron timing in `vercel.json` and code together. Comments and docs are not always aligned.
- Remember cleanup runs after sending.

## Useful Commands

- `npm run dev`
- `npm test`
- `npm run newsletter`
- `npm run clean:articles`
