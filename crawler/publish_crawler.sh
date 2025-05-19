#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------
# Configuration - adapt these if needed
# ---------------------------------------------
IMAGE="ghcr.io/hoangsonww/government-article-curator-crawler:1.1.0"

: "${GITHUB_ACTOR:?Please export GITHUB_ACTOR=<your GitHub username>}"
: "${GH_TOKEN:?Please export GH_TOKEN=<your PAT with write:packages>}"

# ---------------------------------------------
# Build the Docker image
# ---------------------------------------------
echo "🔨 Building Docker image ${IMAGE}"
docker build -t "${IMAGE}" .

# ---------------------------------------------
# Authenticate with GitHub Container Registry
# ---------------------------------------------
echo "🔐 Logging in to GHCR as ${GITHUB_ACTOR}"
echo "${GH_TOKEN}" | docker login ghcr.io -u "${GITHUB_ACTOR}" --password-stdin

# ---------------------------------------------
# Push the image
# ---------------------------------------------
echo "📤 Pushing ${IMAGE}"
docker push "${IMAGE}"

echo "✅ Done! Image available at https://github.com/hoangsonww/packages/container/government-article-curator-crawler"
