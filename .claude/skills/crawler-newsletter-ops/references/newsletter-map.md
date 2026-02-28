# Newsletter Map

## Source Of Truth

- `newsletters/schedule/sendNewsletter.ts`
- `newsletters/pages/api/scheduled/sendNewsletter.ts`
- `newsletters/models/`
- `newsletters/vercel.json`

## Commands

- `npm run dev`
- `npm test`
- `npm run newsletter`
- `npm run clean:articles`

## Important Env

- `MONGODB_URI`
- `RESEND_API_KEY`
- `RESEND_FROM`
- `UNSUBSCRIBE_BASE_URL`

## Known Drift

- docs describe subscribe and unsubscribe endpoints that are not implemented here
- Docker assumptions do not match current build output
- comments about schedule timing may not match `vercel.json`
