---
name: frontend-pages-router
description: Use this skill when changing the Next.js frontend in this repository, especially pages/, components/, services/, auth flows, article detail pages, favorites, translation, or the sitewide AI chat UI.
---

# Frontend Pages Router

This skill is for `frontend/`.

## Working Model

- The app uses the Pages Router.
- UI state is spread across page components, shared components, CSS files, and browser storage.
- Several features depend on client-only APIs and local persistence.

## Working Rules

- Check SSR versus client-only assumptions before moving logic.
- Preserve shallow routing, search debounce, and query synchronization on `/home`.
- Preserve localStorage keys unless the migration is intentional.
- Keep auth token handling consistent when touching requests.
- If you touch the sitewide chat UI, preserve SSE parsing, citations, warnings, and scrolling behavior.

## Validation

- Run `cd frontend && npm run lint` for code changes when feasible.
- Run Playwright for route or interaction changes when the task materially affects UX.

## References

- For route and component map, read `references/frontend-map.md`.
- For chat UI specifics, read `references/chat-ui.md`.
