#!/bin/bash
# deploy.sh — deploy code ใหม่ลง :8000 (DEV port) เท่านั้น
# Production (:9000) ไม่กระทบจน cutover

set -e
cd /home/viivadmin/viiv

DEV_PORT=8000

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
  > logs/uvicorn.log 2>&1 < /dev/null & disown

sleep 3
for i in 1 2 3; do
  if curl -sf "http://localhost:$DEV_PORT/api/platform/health" > /dev/null; then
    echo "✅ Health check passed (attempt $i)"
    echo ""
    echo "🔵 DEV deployed: http://localhost:$DEV_PORT"
    echo "🔵 Test on: https://dev7.viiv.me"
    echo "🟢 Production unchanged: https://test7.viiv.me (still :9000)"
    exit 0
  fi
  echo "⏳ Health check failed, retry $i/3..."
  sleep 2
done

echo "❌ Health check failed after 3 attempts"
echo "💡 Check logs: tail -50 logs/uvicorn.log"
exit 1
