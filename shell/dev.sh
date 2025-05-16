#!/usr/bin/env bash
set -e

echo "Starting frontend, backend, crawler in parallel…"
./shell/dev-frontend.sh &
./shell/dev-backend.sh  &
./shell/dev-crawler.sh  &
wait
