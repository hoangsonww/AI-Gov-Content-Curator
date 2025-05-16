#!/usr/bin/env bash
set -euo pipefail

# Load .env if present
[ -f .env ] && set -a && source .env && set +a

echo "📡 Starting Next.js in development mode..."
npm run dev
