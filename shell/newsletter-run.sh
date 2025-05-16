#!/usr/bin/env bash
set -euo pipefail

[ -f .env ] && set -a && source .env && set +a

echo "✉️  Running newsletter script (TypeScript)..."
npm run newsletter
