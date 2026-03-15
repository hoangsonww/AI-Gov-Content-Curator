#!/usr/bin/env bash
set -e

echo "Starting frontend, backend, crawler..."
./shell/start-frontend.sh
./shell/start-backend.sh
./shell/start-crawler.sh
