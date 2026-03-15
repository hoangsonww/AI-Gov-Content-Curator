# CLI Memory

This directory contains the `aicc` CLI in `bin/aicc.js`.

## Guardrails

- Prefer this CLI over brittle shell wrappers for common monorepo operations when it already covers the task.
- Check root `package.json` alongside this file before adding new commands.
- Be aware that article CRUD commands assume a reachable backend via `AICC_API_URL`.

## Good Uses

- route a user to the right workspace command
- run common `dev`, `build`, `start`, `lint`, and `format` flows
- inspect how the repo expects article CRUD automation to work
