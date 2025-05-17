#!/usr/bin/env bash
set -euo pipefail

LOGFILE="$(pwd)/daily.log"

echo "----------------------------------------" | tee -a "$LOGFILE"
echo "Daily run started at $(date +"%Y-%m-%d %H:%M:%S")" | tee -a "$LOGFILE"
echo "This script is meant to be run daily to complete the following tasks:" | tee -a "$LOGFILE"

# 1️⃣ Run the crawler
echo "" | tee -a "$LOGFILE"
echo "1. 📡 Running crawler…" | tee -a "$LOGFILE"
cd ../crawler
echo "→ cwd: $(pwd)" | tee -a "$LOGFILE"
npm run crawl 2>&1 | tee -a "$LOGFILE"

# 2️⃣ Clean old articles
echo "" | tee -a "$LOGFILE"
echo "2. 🧹 Cleaning articles…" | tee -a "$LOGFILE"
npm run clean:articles 2>&1 | tee -a "$LOGFILE"

# 3️⃣ Send the newsletter
echo "" | tee -a "$LOGFILE"
echo "3. 📨 Sending newsletter…" | tee -a "$LOGFILE"
cd ../newsletters
echo "→ cwd: $(pwd)" | tee -a "$LOGFILE"
npm run newsletter 2>&1 | tee -a "$LOGFILE"

echo "" | tee -a "$LOGFILE"
echo "Daily run finished at $(date +"%Y-%m-%d %H:%M:%S")" | tee -a "$LOGFILE"
echo "----------------------------------------" | tee -a "$LOGFILE"
