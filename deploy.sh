#!/bin/bash
# VIIV Deploy — Blue (port 8000)
# - git pull main
# - pip install -q
# - graceful restart uvicorn
# - health check ×3 ที่ /api/platform/health
# - revert + restart อัตโนมัติถ้า health fail

set -uo pipefail

cd /home/viivadmin/viiv || { echo "❌ chdir failed"; exit 1; }

HEALTH_URL="https://concore.viiv.me/api/platform/health"
LOG="/home/viivadmin/viiv/logs/uvicorn.log"
PORT=8000

restart_uvicorn() {
  kill $(lsof -ti:$PORT) 2>/dev/null
  sleep 2
  source .venv/bin/activate
  nohup uvicorn app.main:app --host 0.0.0.0 --port $PORT > "$LOG" 2>&1 &
  echo "→ uvicorn restarted (port $PORT)"
}

health_check() {
  for i in 1 2 3; do
    sleep 3
    code=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" --max-time 5)
    echo "  health #$i → HTTP $code"
    [ "$code" != "200" ] && return 1
  done
  return 0
}

PREV_HEAD=$(git rev-parse HEAD)

echo "▶ git pull origin main"
git pull origin main || { echo "❌ git pull failed"; exit 1; }

echo "▶ pip install -r requirements.txt"
source .venv/bin/activate
pip install -r requirements.txt -q || { echo "❌ pip install failed"; exit 1; }

echo "▶ restart uvicorn"
restart_uvicorn
echo "→ wait 5s for startup"
sleep 5

echo "▶ health check ×3"
if health_check; then
  echo "✅ Deploy สำเร็จ — commit $(git rev-parse --short HEAD)"
  exit 0
fi

echo "❌ health check ล้มเหลว — Rollback อัตโนมัติ"
git revert HEAD --no-edit || {
  echo "❌ git revert failed — รัน rollback.sh $PREV_HEAD เอง"
  exit 1
}
restart_uvicorn
sleep 5

if health_check; then
  echo "↩️  Rollback สำเร็จ — กลับไปก่อน commit ที่พัง"
  exit 1
fi

echo "❌ Rollback ก็ล้มเหลว — ต้องดูแบบ manual (logs: $LOG)"
exit 2
