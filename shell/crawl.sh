#!/usr/bin/env bash
set -euo pipefail

# run-crawler.sh
# Installs dependencies (if needed) and launches the crawl job

# ensure we’re in the crawler dir
cd "$(dirname "$0")"

echo "✔️  Installing crawler dependencies…"
npm ci

echo "▶️  Starting crawl…"
npm run crawl

echo "✅ Crawl finished."
