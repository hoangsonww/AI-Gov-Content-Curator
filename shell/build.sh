# shell/build.sh
#!/usr/bin/env bash
set -e

echo "Building frontend, backend, crawler…"
./shell/build-frontend.sh
./shell/build-backend.sh
./shell/build-crawler.sh
