# Frontend Guidance

- This app uses the Next.js Pages Router, not the App Router.
- Preserve browser-only behavior around `localStorage`, cookies, `window`, and shallow routing.
- Be careful on `pages/home.tsx`, `pages/articles/[id].tsx`, and `pages/ai_chat.tsx`; they are the most coupled flows.
- Keep API base URL handling consistent when touching `services/` or chat paths.
- Run `npm run lint`; add Playwright when route or interaction behavior changes.
