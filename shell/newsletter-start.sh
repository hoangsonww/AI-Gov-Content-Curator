#!/usr/bin/env bash
set -euo pipefail

[ -f .env ] && set -a && source .env && set +a

echo "🚀 Starting Next.js in production mode..."
npm run start
