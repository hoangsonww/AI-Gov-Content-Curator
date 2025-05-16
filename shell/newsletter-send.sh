#!/usr/bin/env bash
set -euo pipefail

[ -f .env ] && set -a && source .env && set +a

echo "📤 Running compiled newsletter sender..."
npm run send
