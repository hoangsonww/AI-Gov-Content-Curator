#!/usr/bin/env bash
# pre-command-guard.sh -- blocks destructive commands before execution.
# Wired via .claude/settings.json as a pre-command hook.
#
# Blocks:
#   - git push --force to main/master
#   - git reset --hard
#   - rm -rf /
#   - DROP TABLE (SQL injection guard)
#
# Warns (non-blocking):
#   - Live newsletter sends without --dry-run
#   - Crawl commands without --limit

set -euo pipefail

CMD="${1:-}"

if [ -z "$CMD" ]; then
  exit 0
fi

# --- Hard blocks (exit 1 to abort) ---

# Block force push to main or master
if echo "$CMD" | grep -qiE 'git\s+push\s+.*--force.*\b(main|master)\b'; then
  echo "BLOCKED: Force push to main/master is not allowed." >&2
  echo "Use a feature branch and create a pull request instead." >&2
  exit 1
fi
if echo "$CMD" | grep -qiE 'git\s+push\s+.*\b(main|master)\b.*--force'; then
  echo "BLOCKED: Force push to main/master is not allowed." >&2
  echo "Use a feature branch and create a pull request instead." >&2
  exit 1
fi

# Block git reset --hard
if echo "$CMD" | grep -qiE 'git\s+reset\s+--hard'; then
  echo "BLOCKED: git reset --hard can destroy uncommitted work." >&2
  echo "Use git stash or git checkout <file> for targeted reverts." >&2
  exit 1
fi

# Block rm -rf /
if echo "$CMD" | grep -qiE 'rm\s+-rf\s+/[^a-zA-Z]' || echo "$CMD" | grep -qiE 'rm\s+-rf\s+/$'; then
  echo "BLOCKED: rm -rf / is catastrophic and not permitted." >&2
  exit 1
fi

# Block DROP TABLE
if echo "$CMD" | grep -qiE 'DROP\s+TABLE'; then
  echo "BLOCKED: DROP TABLE detected. Database schema changes require manual review." >&2
  exit 1
fi

# --- Warnings (non-blocking, print to stderr) ---

# Warn on live newsletter sends
if echo "$CMD" | grep -qiE 'npm\s+run\s+newsletter' && ! echo "$CMD" | grep -qi '\-\-dry-run'; then
  echo "WARNING: Live newsletter send detected without --dry-run flag." >&2
  echo "This will send real emails to subscribers. Proceed with caution." >&2
fi

# Warn on crawl commands without --limit
if echo "$CMD" | grep -qiE 'npm\s+run\s+crawl' && ! echo "$CMD" | grep -qi '\-\-limit'; then
  echo "WARNING: Crawl command detected without --limit flag." >&2
  echo "This may hit external sites with unbounded requests. Consider adding --limit." >&2
fi

exit 0
