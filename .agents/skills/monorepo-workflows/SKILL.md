---
name: monorepo-workflows
description: Route work to the correct service and command surface in the SynthoraAI monorepo. Use when Codex needs repository-specific guidance about which directory owns a task, which commands are canonical, which wrappers are stale, what validation to run, or which paths are generated and should not be edited.
---

# Monorepo Workflows

Identify the owning service before changing code.

## Follow This Workflow

1. Map the task to `backend/`, `frontend/`, `crawler/`, `newsletters/`, `agentic_ai/`, `infrastructure/`, `shell/`, or `bin/`.
2. Read the nearest `AGENTS.md` for that directory.
3. Prefer root/workspace `package.json` scripts and `bin/aicc.js` over shell wrappers when both exist.
4. Edit source files, not generated output.
5. Run the narrowest useful validation for the touched surface.

## Use The References

- Read `references/service-map.md` for ownership, commands, and known drift.
- Read `references/validation-map.md` when the change spans multiple services.
