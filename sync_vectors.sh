#!/usr/bin/env bash
set -euo pipefail

# ─── Load NVM so npm/node are on the PATH ───
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
else
  echo "⚠️  Warning: nvm not found at $NVM_DIR; ensure Node is on PATH" >&2
fi

# ─── Bootstrap into the script's own directory ───
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/backend"

LOGFILE="$SCRIPT_DIR/sync_vectors.log"

# Prevent concurrent execution
LOCKFILE="/tmp/sync_vectors.sh.lock"
exec 200>"$LOCKFILE"
flock -n 200 || { echo "$(date): Another instance is already running" >> "$LOGFILE"; exit 1; }

# Notify on failure
trap 'echo "$(date): sync_vectors.sh FAILED" >> "$LOGFILE"' ERR

echo "----------------------------------------" | tee -a "$LOGFILE"
echo "Sync vectors started at $(date +"%Y-%m-%d %H:%M:%S")" | tee -a "$LOGFILE"
echo "" | tee -a "$LOGFILE"

# Run the sync script
npm ci --omit=dev --silent               2>&1 | tee -a "$LOGFILE"
npm run sync-missing-vectors      2>&1 | tee -a "$LOGFILE"

echo "" | tee -a "$LOGFILE"
echo "Sync vectors finished at $(date +"%Y-%m-%d %H:%M:%S")" | tee -a "$LOGFILE"
echo "----------------------------------------" | tee -a "$LOGFILE"
