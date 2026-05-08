# Frontend Memory

This app uses the Next.js Pages Router, not the App Router.

## What Matters

- Routes live under `pages/`.
- Shared UI and most logic live under `components/`.
- Data access lives under `services/`.
- Styling is mostly global CSS and `styled-jsx`, not a Tailwind-first design system.
- The heaviest and most fragile surfaces are `pages/home.tsx`, `pages/articles/[id].tsx`, `pages/ai_chat.tsx`, auth pages (`pages/auth/*`, `pages/account/passkeys.tsx`), favorites, and translation/theme behavior.
- Passkey UI is gated by `isPasskeySupported()` from `services/api.ts` — buttons render only after client-side hydration (SSR returns false). Don't move the check into module top-level or it'll break SSR.

## Guardrails

- Assume browser-only APIs are part of live behavior. Check for `localStorage`, `window`, cookies, and client-side routing before moving logic server-side.
- Preserve query-param and shallow-routing behavior on `/home`.
- Preserve `localStorage` keys unless the migration is deliberate.
- Keep API base URL handling consistent when you touch request code. The repo currently mixes hard-coded URLs and `NEXT_PUBLIC_API_URL`.
- For article detail pages, remember comments, ratings, favorites, related articles, bias analysis, and chat are separate moving parts.

## Useful Commands

- `npm run dev`
- `npm run lint`
- `npm run test:e2e`
- `npm run test:e2e:headed`
