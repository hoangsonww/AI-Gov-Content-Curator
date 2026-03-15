# Newsletter Guidance

- Main job logic lives in `schedule/sendNewsletter.ts`.
- Treat newsletter runs as live email sends unless proven otherwise.
- Remember the job mutates subscriber `lastSentAt` and runs cleanup afterward.
- Verify cron timing in `vercel.json` and code together; comments and docs are not fully reliable.
- Run `npm test` before job changes when feasible.
