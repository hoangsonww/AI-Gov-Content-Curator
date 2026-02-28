---
name: release-readiness
description: Use this skill when you want Claude Code to check whether a change in this repository is ready to hand off, merge, or deploy. It is best for deciding what validation is still missing across backend, frontend, crawler, newsletters, agentic_ai, or infrastructure.
---

# Release Readiness

Use this skill after implementing a change.

## Workflow

1. Identify the touched services from the changed files.
2. Map each touched area to its minimum useful validation.
3. Check for obvious repo-specific drift risks:
   - generated output edited instead of source
   - backend or crawler scheduled paths mismatched
   - frontend API URL inconsistency introduced
   - newsletter or crawler live-side-effect commands run unintentionally
   - infra placeholders or mutable tags left behind
4. Report:
   - what is validated
   - what is unvalidated
   - what should block merge versus what is residual risk

## Minimum Validation Hints

- `backend/`: `npm test`
- `frontend/`: `npm run lint`, plus Playwright for user-flow changes
- `crawler/`: `npm test`
- `newsletters/`: `npm test`
- `agentic_ai/`: static review unless Python environment is confirmed
- `infrastructure/`: manifest/script consistency review unless deploy tooling is confirmed

## References

- Read `references/validation-matrix.md` if the touched surface spans multiple services.
