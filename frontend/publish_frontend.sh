#!/usr/bin/env bash
#
# publish_frontend.sh
#
# Builds the Next.js frontend Docker image and pushes it to GitHub Container Registry (GHCR).
#
# Prerequisites:
#   - You must have a Personal Access Token with the `write:packages` scope.
#   - Export your credentials in your shell:
#       export GITHUB_ACTOR="hoangsonww"
#       export GH_TOKEN="<your_GHCR_PAT>"
#
# How to run:
#   chmod +x publish_frontend.sh
#   ./publish_frontend.sh
#

set -euo pipefail

# ----------------------------------------------------------------------------
# Image configuration
# ----------------------------------------------------------------------------
# Replace "estatewise-frontend" with your desired image name
IMAGE="ghcr.io/hoangsonww/estatewise-frontend:latest"

# Ensure required env vars are set
: "${GITHUB_ACTOR:?Please export GITHUB_ACTOR=<your GitHub username>}"
: "${GH_TOKEN:?Please export GH_TOKEN=<your PAT with write:packages>}"

echo "🔨 Building Docker image: $IMAGE"

# Build the image (reads Dockerfile in current directory)
docker build \
  --label org.opencontainers.image.title="estatewise-frontend" \
  --label org.opencontainers.image.version="latest" \
  --label org.opencontainers.image.description="Production build of the EstateWise Next.js frontend" \
  -t "$IMAGE" .

echo "🔐 Logging in to GHCR (ghcr.io) as $GITHUB_ACTOR"
echo "$GH_TOKEN" | docker login ghcr.io \
  --username "$GITHUB_ACTOR" \
  --password-stdin

echo "📤 Pushing image to GHCR: $IMAGE"
docker push "$IMAGE"

echo "✅ Image pushed successfully!"
echo "👉 Pull with: docker pull $IMAGE"
