#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker/docker-compose.yaml"

echo "Running internal health verification..."

API_CONTAINER=$(docker compose -f "$COMPOSE_FILE" ps -q api)
PROXY_CONTAINER=$(docker compose -f "$COMPOSE_FILE" ps -q reverse-proxy)

if [[ -z "$API_CONTAINER" || -z "$PROXY_CONTAINER" ]]; then
    echo "Required containers not running."
    exit 1
fi

# Check API directly inside container
docker exec "$API_CONTAINER" curl -fsSL http://localhost:8080/healthz >/dev/null

# Check reverse proxy via HTTP (no DNS dependency)
docker exec "$PROXY_CONTAINER" curl -fsSL http://localhost/healthz >/dev/null

echo "Health verification PASSED."
exit 0
