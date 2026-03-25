# Bead Task Decomposition System

Beads are the atomic unit of work in the SynthoraAI agentic architecture. Each bead represents a discrete, well-scoped task that an agent (human or AI) can claim, execute, and verify independently.

## Bead ID Format

Bead identifiers follow the pattern `{SERVICE}-{NUMBER}`:

| Prefix  | Service / Domain                     | Example     |
|---------|--------------------------------------|-------------|
| `ORCH`  | Orchestration layer (TypeScript)     | `ORCH-001`  |
| `MCP`   | MCP server (Python)                  | `MCP-003`   |
| `PIPE`  | Python agentic pipeline              | `PIPE-012`  |
| `CRAWL` | Crawler service                      | `CRAWL-005` |
| `NEWS`  | Newsletter service                   | `NEWS-002`  |
| `INFRA` | Infrastructure / Terraform / K8s     | `INFRA-008` |
| `DOCS`  | Documentation                        | `DOCS-004`  |
| `TEST`  | Test coverage                        | `TEST-007`  |

Numbers are zero-padded to three digits and increment per prefix.

## Bead Lifecycle

```
PENDING --> CLAIMED --> IN_PROGRESS --> REVIEW --> DONE
                \                        /
                 \-----> BLOCKED ------>/
```

| State         | Meaning                                                       |
|---------------|---------------------------------------------------------------|
| `PENDING`     | Task defined but not yet assigned.                            |
| `CLAIMED`     | An agent has reserved the bead and intends to start.          |
| `IN_PROGRESS` | Active work is underway.                                      |
| `REVIEW`      | Work is complete and awaiting verification.                   |
| `DONE`        | Verified and merged.                                          |
| `BLOCKED`     | Cannot proceed; dependency or external blocker.               |

## File Reservation Rules

To prevent conflicts when multiple agents operate concurrently:

1. **Claim before editing.** Before modifying any file, the agent must transition the bead to `CLAIMED` and record the file paths in `.beads/.status.json` under `reservations`.
2. **One owner per file.** A file path may appear in at most one active reservation at a time. If another bead already reserves the file, the agent must wait or negotiate.
3. **Release on completion.** When a bead transitions to `DONE` or `BLOCKED`, its reservations are automatically released.
4. **Conflict zones.** Certain files are high-contention and require extra coordination:
   - `docker-compose.yml`
   - `package.json` (root)
   - `.env.example`
   - `CLAUDE.md`
   - `ARCHITECTURE.md`
5. **Safe parallel zones.** These directories are isolated enough for concurrent work:
   - `orchestration/src/agents/prompts/` (one file per agent)
   - `agentic_ai/agents/` (one file per agent)
   - `.claude/skills/` (one file per skill)
   - Test files (scoped to their own suite)

## Status File

The file `.beads/.status.json` tracks active beads and file reservations. Structure:

```json
{
  "version": "1.0.0",
  "lastUpdated": "2026-03-24T14:00:00Z",
  "beads": {
    "ORCH-001": {
      "title": "Implement ChatSupervisor",
      "state": "IN_PROGRESS",
      "assignee": "agent-a",
      "files": ["orchestration/src/supervisors/chat-supervisor.ts"]
    }
  },
  "reservations": {
    "orchestration/src/supervisors/chat-supervisor.ts": "ORCH-001"
  }
}
```

## Creating a New Bead

1. Choose the correct prefix from the table above.
2. Assign the next available number for that prefix.
3. Add the bead to `.beads/.status.json` with state `PENDING`.
4. Include a clear title and list of files that will be touched.
5. Transition to `CLAIMED` when starting work.

## Compound Learning

After completing a bead (state = `DONE`), agents should record learnings in `.agent-sessions/` using the compound review skill. This feeds back into future task planning and estimation.
