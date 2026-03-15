---
name: drift-audit
description: Audit this repository for docs-to-code drift, broken paths, stale wrappers, inconsistent environment assumptions, or other mismatches between implementation and operational guidance. Use when Codex needs to verify whether repo docs, scripts, schedules, Dockerfiles, or MCP guidance still match the code.
---

# Drift Audit

Prefer concrete implementation mismatches over generic cleanup advice.

## Follow This Workflow

1. Compare the doc or wrapper layer to the implementation files it claims to represent.
2. Run `python3 scripts/check_repo_drift.py` for the repo’s current known hotspots.
3. Report what is broken now, what is stale but non-blocking, and what is risky to fix without broader validation.

## Use The References

- Read `references/drift-hotspots.md` when the task is a broad repo audit.
