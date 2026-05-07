#!/bin/bash
# deploy.sh — deploy code ใหม่ลง DEV port (auto-detect จาก Caddyfile dev7 block)
# Production (LIVE port) ไม่กระทบจน cutover
#
# Detection: dev7.viiv.me /api/* → DEV port (9000 หรือ 8000)

set -e
cd /home/viivadmin/viiv

CADDYFILE=/etc/caddy/Caddyfile
DEV_PORT=$(sudo awk '/^dev7\.viiv\.me/,/^}/' $CADDYFILE | grep -oP "reverse_proxy localhost:\K[0-9]+" | grep -v "8003" | head -1)
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
