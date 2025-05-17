#!/usr/bin/env bash
#
# enter_compute.sh
#
# Opens an interactive shell in the running Docker container named "compute".
# Usage: ./enter_compute.sh [container_name]
#

set -euo pipefail

# Default container name
CONTAINER_NAME="${1:-compute}"

# Find the container ID
container_id=$(docker ps -qf "name=^${CONTAINER_NAME}$")

if [[ -z "$container_id" ]]; then
  echo "❌ No running container found with name '${CONTAINER_NAME}'"
  exit 1
fi

# Try bash, fall back to sh
if docker exec "$container_id" which bash &>/dev/null; then
  SHELL_CMD="bash"
else
  SHELL_CMD="sh"
fi

echo "→ Attaching to container '${CONTAINER_NAME}' ($container_id) with shell '${SHELL_CMD}'"
docker exec -it "$container_id" "$SHELL_CMD"
