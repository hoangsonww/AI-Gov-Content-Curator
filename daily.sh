#!/usr/bin/env bash
set -euo pipefail

# ─── Load NVM so npm/node are on the PATH ───
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
else
  echo "⚠️  Warning: nvm not found at $NVM_DIR; ensure Node is on PATH" >&2
fi

# ─── Bootstrap into the script’s own directory ───
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOGFILE="$SCRIPT_DIR/daily.log"

echo "----------------------------------------" | tee -a "$LOGFILE"
echo "Daily run started at $(date +"%Y-%m-%d %H:%M:%S")" | tee -a "$LOGFILE"
echo "This script is meant to run daily to complete the following tasks:" | tee -a "$LOGFILE"

# 1️⃣ Run the crawler
echo "" | tee -a "$LOGFILE"
echo "1. 📡 Running crawler… (cwd: $SCRIPT_DIR/crawler)" | tee -a "$LOGFILE"
cd "$SCRIPT_DIR/crawler"
npm install --silent               2>&1 | tee -a "$LOGFILE"
npm run crawl                     2>&1 | tee -a "$LOGFILE"

# 2️⃣ Clean old articles
echo "" | tee -a "$LOGFILE"
echo "2. 🧹 Cleaning articles… (cwd: $SCRIPT_DIR/crawler)" | tee -a "$LOGFILE"
npm run clean:articles            2>&1 | tee -a "$LOGFILE"

# 3️⃣ Send the newsletter
echo "" | tee -a "$LOGFILE"
echo "3. 📨 Sending newsletter… (cwd: $SCRIPT_DIR/newsletters)" | tee -a "$LOGFILE"
cd "$SCRIPT_DIR/newsletters"
npm install --silent               2>&1 | tee -a "$LOGFILE"
npm run newsletter                2>&1 | tee -a "$LOGFILE"

echo "" | tee -a "$LOGFILE"
echo "Daily run finished at $(date +"%Y-%m-%d %H:%M:%S")" | tee -a "$LOGFILE"
echo "----------------------------------------" | tee -a "$LOGFILE"

# Script completed successfully - visit daily.log for details
