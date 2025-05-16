#!/usr/bin/env bash
set -euo pipefail

# Run backend unit & integration tests in a single, in-memory MongoDB instance

# Ensure NODE_ENV=test so any production logic is skipped
export NODE_ENV=test

echo "Installing dependencies (if needed)…"
npm ci

echo "Running Jest against backend…"
npx jest --config jest.config.js --runInBand --detectOpenHandles --forceExit "$@"
