#!/bin/bash
# Destroy 1 session
set -euo pipefail
SESSION_ID="${1:?session_id required}"

echo "Destroying session: $SESSION_ID"

# Stop Firefox first
docker stop "firefox-${SESSION_ID}" 2>/dev/null || echo "  Firefox already stopped"

# Stop Squid
docker stop "squid-${SESSION_ID}" 2>/dev/null || echo "  Squid already stopped"

# Cleanup temp config (contains credential)
rm -rf "/tmp/squid-conf-${SESSION_ID}"

# Verify no orphan
sleep 2
if docker ps -a 2>/dev/null | grep -q "${SESSION_ID}"; then
    echo "❌ Orphan found"
    docker ps -a | grep "${SESSION_ID}"
    exit 1
fi
echo "✅ Cleanup complete"
