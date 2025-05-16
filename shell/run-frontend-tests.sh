#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./run-frontend-tests.sh           # headless
#   ./run-frontend-tests.sh headed    # headed mode
#   ./run-frontend-tests.sh report    # show HTML report

cd frontend

echo "Installing dependencies…"
npm ci

echo "Building the Next.js app…"
npm run build

MODE=${1:-headless}

case "$MODE" in
  headless)
    echo "Running Playwright tests (headless)…"
    npm run test:e2e
    ;;
  headed)
    echo "Running Playwright tests (headed)…"
    npm run test:e2e:headed
    ;;
  report)
    echo "Opening Playwright HTML report…"
    npm run test:e2e:report
    ;;
  *)
    echo "Unknown mode: $MODE"
    echo "Usage: $0 [headless|headed|report]"
    exit 1
    ;;
esac
