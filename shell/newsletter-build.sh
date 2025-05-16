#!/usr/bin/env bash
set -euo pipefail

[ -f .env ] && set -a && source .env && set +a

echo "🛠  Building Next.js for production..."
npm run build
