#!/usr/bin/env bash
#
# publish_backend.sh
#
# Builds the Docker image for the backend and pushes it to GitHub Container Registry (GHCR).
#
# Prerequisites:
#   - You must have a Personal Access Token with the `write:packages` scope.
#   - Export your credentials in your shell:
#       export GITHUB_ACTOR="hoangsonww"
#       export GH_TOKEN="<your_GHCR_PAT>"
#
# How to run:
#   chmod +x publish_backend.sh
#   ./publish_backend.sh
#
set -euo pipefail

# ----------------------------------------------------------------------------
# Image configuration
# ----------------------------------------------------------------------------
IMAGE="ghcr.io/hoangsonww/government-article-curator-backend:1.0.0"

# Ensure required env vars are set
: "${GITHUB_ACTOR:?Please export GITHUB_ACTOR=<your GitHub username>}"
: "${GH_TOKEN:?Please export GH_TOKEN=<your PAT with write:packages>}"

echo "🔨 Building Docker image: $IMAGE"

# Build the image
docker build \
  --label org.opencontainers.image.source="https://github.com/hoangsonww/AI-Gov-Content-Curator" \
  -t "$IMAGE" .

echo "🔐 Authenticating to GitHub Container Registry (ghcr.io)"
# Login to GHCR using your PAT stored in GH_TOKEN
echo "$GH_TOKEN" | docker login ghcr.io \
  --username "$GITHUB_ACTOR" \
  --password-stdin

echo "📤 Pushing image: $IMAGE"
docker push "$IMAGE"

echo "✅ Image pushed successfully!"
echo "👉 You can pull it via: docker pull $IMAGE"
