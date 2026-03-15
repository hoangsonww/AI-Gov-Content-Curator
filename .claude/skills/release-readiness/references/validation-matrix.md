# Validation Matrix

## Backend

Run backend Jest tests for:

- controller changes
- auth changes
- model or script changes
- chat backend changes

## Frontend

Run lint for:

- components
- pages
- service wrappers

Run Playwright when behavior changes affect:

- `/home`
- article detail page
- auth pages
- favorites
- sitewide chat

## Crawler

Run crawler tests before any live crawl command.

## Newsletters

Run newsletter tests before any live send command.

## Agentic AI

Prefer consistency review unless the Python environment is confirmed and dependencies are installed.

## Infrastructure

Prefer drift review plus config sanity checks unless a full deploy environment is explicitly available.
