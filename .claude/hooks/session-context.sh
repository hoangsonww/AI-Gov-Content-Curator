#!/usr/bin/env bash
set -euo pipefail

cat <<'EOF'
Repo context:
- Source of truth is workspace source, not generated output.
- Prefer root and workspace package scripts, plus bin/aicc.js, over older shell wrappers.
- Backend, crawler, and newsletters have real side effects; avoid live jobs unless explicitly requested.
- Frontend uses the Pages Router and many browser-only APIs.
- Read nested CLAUDE.md files when working inside a service.
EOF
