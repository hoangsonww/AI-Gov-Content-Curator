---
name: frontend-pages-router
description: Change or review the Next.js frontend in this repository. Use when work touches frontend/pages, frontend/components, frontend/services, auth UX, article detail flows, sitewide chat UI, browser-only state, or Pages Router behavior.
---

# Frontend Pages Router

Preserve client-side behavior before refactoring structure.

## Follow This Workflow

1. Identify the route or component that owns the behavior.
2. Check for browser-only dependencies such as `localStorage`, cookies, `window`, and shallow routing.
3. Preserve query syncing and debounce behavior on `/home`.
4. Preserve article detail flows across favorites, comments, ratings, related content, bias analysis, and chat.
5. Validate with `cd frontend && npm run lint`; add Playwright when the change affects route behavior or interactions.

## Use The References

- Read `references/frontend-map.md` for high-risk routes and components.
- Read `references/chat-ui.md` when the task touches the sitewide chat page.
