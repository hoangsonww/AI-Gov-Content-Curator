# Agent Session Memory

This directory stores session logs and compound learnings from completed beads. Each entry captures what an agent learned during task execution so that future agents can benefit from accumulated experience.

## Session File Format

Session files are named `{BEAD_ID}_{TIMESTAMP}.md` and follow this structure:

```markdown
# Session: {BEAD_ID} - {Title}

## Metadata
- **Bead:** {BEAD_ID}
- **Agent:** {agent identifier}
- **Started:** {ISO timestamp}
- **Completed:** {ISO timestamp}
- **Duration:** {human-readable}

## Summary
One-paragraph description of what was accomplished.

## Files Touched
- `path/to/file1.ts` -- reason for change
- `path/to/file2.py` -- reason for change

## Learnings
1. {Insight about the codebase, a pattern, or a pitfall.}
2. {Insight about a dependency or integration point.}
3. {Insight about testing or validation.}

## Gotchas
- {Something unexpected that cost time.}

## Recommendations
- {Suggestion for future work on related beads.}
```

## Purpose

The compound learning loop works as follows:

1. Agent completes a bead and transitions it to `DONE`.
2. Agent runs the `compound-review` skill (`.claude/skills/compound-review.md`).
3. The skill extracts structured learnings and writes them here.
4. Future agents read recent sessions before starting related beads to avoid repeating mistakes and to reuse proven approaches.

## Retention

- Sessions older than 90 days may be archived or summarized.
- High-value learnings (tagged `[KEEP]` in the Learnings section) are preserved indefinitely.
- The directory should not exceed 200 files; oldest non-`[KEEP]` files are pruned first.

## Querying Sessions

To find sessions related to a specific service or topic:

```bash
# Find all orchestration-related sessions
ls .agent-sessions/ORCH-*.md

# Search for a keyword across all sessions
grep -rl "ChatSupervisor" .agent-sessions/
```
