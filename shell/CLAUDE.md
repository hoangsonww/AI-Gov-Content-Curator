# Shell Toolkit Memory

This directory contains developer and operational wrappers.

## Guardrails

- Treat these scripts as convenience wrappers, not always the source of truth.
- Verify relative paths before trusting a shell wrapper.
- Prefer root `package.json`, workspace `package.json`, and `bin/aicc.js` if a shell script looks stale or ambiguous.
- Do not expand shell usage casually into more wrapper layers unless there is a real repeatability benefit.

## What To Check

- whether the script assumes being run from `shell/` instead of repo root
- whether the same workflow already exists in root scripts or `bin/aicc.js`
- whether the script triggers a live crawler or newsletter action
