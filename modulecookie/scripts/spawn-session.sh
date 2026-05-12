#!/bin/bash
# Spawn 1 session (Firefox + Squid sidecar pair)
# Usage: ./spawn-session.sh <session_id>
set -euo pipefail

SESSION_ID="${1:?session_id required}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODULE_DIR="$(dirname "$SCRIPT_DIR")"

# Read only NODEMAVEN_PROXY — avoid sourcing full .env (other values have shell-unsafe chars)
PROXY_RAW=$(grep "^NODEMAVEN_PROXY=" /home/viivadmin/viiv/.env | cut -d= -f2-)

if [ -z "$PROXY_RAW" ]; then
    echo "❌ NODEMAVEN_PROXY not found in .env"
    exit 1
fi

# Parse credential
PROXY_HOST=$(echo "$PROXY_RAW" | sed -E 's|.*@([^:]+):([0-9]+).*|\1|')
PROXY_PORT=$(echo "$PROXY_RAW" | sed -E 's|.*@[^:]+:([0-9]+)$|\1|')
PROXY_USER=$(echo "$PROXY_RAW" | sed -E 's|^https?://([^:]+):.*|\1|')
PROXY_PASS=$(echo "$PROXY_RAW" | sed -E 's|^https?://[^:]+:([^@]+)@.*|\1|')

if [ -z "$PROXY_HOST" ] || [ -z "$PROXY_PORT" ] || [ -z "$PROXY_USER" ] || [ -z "$PROXY_PASS" ]; then
    echo "❌ Failed to parse NODEMAVEN_PROXY"
    exit 1
fi

echo "Spawning session: $SESSION_ID"
echo "  Proxy host: $PROXY_HOST:$PROXY_PORT"
echo "  Proxy user: ${PROXY_USER:0:5}***"

# Generate squid.conf with substitutions
SQUID_CONF_DIR="/tmp/squid-conf-${SESSION_ID}"
mkdir -p "$SQUID_CONF_DIR"
chmod 700 "$SQUID_CONF_DIR"

# Escape special chars in password for sed
ESCAPED_PASS=$(printf '%s\n' "$PROXY_PASS" | sed -e 's/[\/&|]/\\&/g')

sed -e "s|{PROXY_HOST}|${PROXY_HOST}|g" \
    -e "s|{PROXY_PORT}|${PROXY_PORT}|g" \
    -e "s|{PROXY_USER}|${PROXY_USER}|g" \
    -e "s|{PROXY_PASS}|${ESCAPED_PASS}|g" \
    "$MODULE_DIR/squid/squid.conf.template" > "$SQUID_CONF_DIR/squid.conf"

chmod 600 "$SQUID_CONF_DIR/squid.conf"

# Spawn Squid sidecar
SQUID_NAME="squid-${SESSION_ID}"
docker run -d \
    --name "$SQUID_NAME" \
    --rm \
    --network viiv-cookie-sandbox \
    --network-alias squid-sidecar \
    --memory=128m \
    --cpus=0.5 \
    -v "$SQUID_CONF_DIR/squid.conf:/etc/squid/squid.conf:ro" \
    ubuntu/squid:latest

echo "✅ Squid spawned: $SQUID_NAME"
sleep 5

# Verify Squid healthy
if ! docker ps | grep -q "$SQUID_NAME"; then
    echo "❌ Squid container died — check logs:"
    docker logs "$SQUID_NAME" 2>&1 | tail -20
    exit 1
fi
echo "✅ Squid healthy"

# Spawn Firefox
FIREFOX_NAME="firefox-${SESSION_ID}"
docker run -d \
    --name "$FIREFOX_NAME" \
    --rm \
    --network viiv-cookie-sandbox \
    -p 127.0.0.1:5800:5800 \
    --memory=2g \
    --cpus=1.0 \
    --shm-size=2g \
    -e DISPLAY_WIDTH=390 \
    -e DISPLAY_HEIGHT=844 \
    -e FF_KIOSK=1 \
    -e FF_OPEN_URL=https://m.facebook.com/login \
    -v "$MODULE_DIR/policies/policies.json:/etc/firefox/policies/policies.json:ro" \
    -v "$MODULE_DIR/policies/user.js:/config/profile/user.js:ro" \
    jlesage/firefox:latest

echo "✅ Firefox spawned: $FIREFOX_NAME"
echo ""
echo "Session $SESSION_ID ready."
echo "Access:"
echo "  ssh -L 5800:localhost:5800 viivadmin@dev7.viiv.me"
echo "  Then open http://localhost:5800/"
echo ""
echo "Stop session:"
echo "  $SCRIPT_DIR/destroy-session.sh $SESSION_ID"
