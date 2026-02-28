---
name: release-readiness
description: Check whether work in this repository is ready to hand off, merge, or deploy. Use when Codex needs to map changed files to the right validation commands, identify untested high-risk surfaces, or summarize what is still blocking release readiness across backend, frontend, crawler, newsletters, agentic_ai, or infrastructure.
---

# Release Readiness

Map changed files to the minimum useful validation before declaring work ready.

## Follow This Workflow

1. Identify the touched services from the changed files.
2. Run `python3 scripts/suggest_validation.py` with the changed paths, or run it with no arguments to inspect the current working tree.
3. Separate validated work, unvalidated work, and true blockers.
4. Call out repo-specific risks such as mixed API base configuration, scheduled path drift, live job commands, and deployment placeholders.

## Use The References

- Read `references/validation-matrix.md` when the change spans multiple services.
