#!/bin/bash
# deploy.sh — deploy code ใหม่ลง DEV port (auto-detect จาก Caddyfile dev7 block)
# Production (LIVE port) ไม่กระทบจน cutover
#
# Detection: dev7.viiv.me /api/* → DEV port (9000 หรือ 8000)

set -e
cd /home/viivadmin/viiv

CADDYFILE=/etc/caddy/Caddyfile

# Approach B: hardcode expected + cross-verify against Caddyfile /api/* block
# (head -1 on full block matched :8006/fbchat before :9000 — incident 2026-05-12)
EXPECTED_DEV_PORT=9000
ACTUAL_DEV_PORT=$(sudo awk '/^dev7\.viiv\.me/,/^}/' $CADDYFILE | \
    awk '/handle \/api\/\*/,/\}/' | \
    grep -oP "reverse_proxy localhost:\K[0-9]+" | head -1)
if [ "$ACTUAL_DEV_PORT" != "$EXPECTED_DEV_PORT" ]; then
  echo "❌ Caddyfile dev7 /api/* port ($ACTUAL_DEV_PORT) != expected ($EXPECTED_DEV_PORT)"
  echo "ABORT: refuse to deploy with unexpected port"
  exit 1
fi
DEV_PORT=$EXPECTED_DEV_PORT

if [ -z "$DEV_PORT" ]; then
  echo "❌ ไม่พบ DEV port จาก Caddyfile dev7 block — abort"
  exit 1
fi

echo "🔵 Deploying to DEV (:$DEV_PORT)..."

git pull

if git diff HEAD@{1} HEAD --name-only 2>/dev/null | grep -q "requirements.txt"; then
  echo "📦 Installing requirements..."
  source .venv/bin/activate
  pip install -r requirements.txt
fi

echo "⏹️  Stopping old :$DEV_PORT..."
# Sanity: refuse to kill reserved/production ports
if [[ "$DEV_PORT" =~ ^(8000|8002|8003|8005|8006|8008|8009|8010)$ ]]; then
  echo "❌ DEV_PORT=$DEV_PORT is a reserved/production port — ABORT"
  exit 1
fi
pkill -f "uvicorn.*--port $DEV_PORT" || true
sleep 2

echo "▶️  Starting :$DEV_PORT..."
source .venv/bin/activate
setsid nohup python -m uvicorn app.main:app \
  --host 0.0.0.0 --port $DEV_PORT \
  > logs/uvicorn-$DEV_PORT.log 2>&1 < /dev/null & disown

sleep 3
for i in 1 2 3; do
  if curl -sf "http://localhost:$DEV_PORT/api/platform/health" > /dev/null; then
    echo "✅ Health check passed (attempt $i)"
    echo ""
    echo "🔵 DEV deployed: http://localhost:$DEV_PORT"
    echo "🔵 Test on: https://dev7.viiv.me"
    echo "🟢 LIVE unchanged (test7 + concore → port อีกฝั่ง)"
    exit 0
  fi
  echo "⏳ Health check failed, retry $i/3..."
  sleep 2
done

echo "❌ Health check failed after 3 attempts"
echo "💡 Check logs: tail -50 logs/uvicorn-$DEV_PORT.log"
exit 1
