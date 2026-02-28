---
name: drift-audit
description: Use this skill when you want Claude Code to audit this repository for docs-to-code drift, broken paths, stale scripts, inconsistent environment assumptions, or mismatches between implementation and operational docs.
---

# Drift Audit

Use this skill for repo hygiene and extension maintenance.

## Audit Targets

- README versus actual scripts and routes
- Dockerfiles versus build output
- `vercel.json` versus scheduled routes and comments
- root scripts versus `shell/` wrappers
- compiled `.js` files checked in beside `.ts` source
- MCP and agentic pipeline runtime claims versus current Python code
- infrastructure docs versus manifests and scripts

## Workflow

1. Pick the directories implicated by the user request.
2. Compare the doc or wrapper layer to the actual implementation.
3. Prefer findings with concrete file paths and real operational impact.
4. Separate:
   - broken now
   - likely stale but harmless
   - risky to fix without broader validation

## References

- Read `references/drift-hotspots.md` before broad repo audits.
