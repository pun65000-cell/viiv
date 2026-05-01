#!/bin/bash
# VIIV Rollback — Blue (port 8000)
# Usage: ./rollback.sh [commit-hash]   (default: HEAD~1)

set -uo pipefail

cd /home/viivadmin/viiv || { echo "❌ chdir failed"; exit 1; }

TARGET="${1:-HEAD~1}"
HEALTH_URL="https://concore.viiv.me/api/platform/health"
LOG="/home/viivadmin/viiv/logs/uvicorn.log"
PORT=8000

# resolve to a real hash for echo + safety
RESOLVED=$(git rev-parse --verify "$TARGET" 2>/dev/null) || {
  echo "❌ commit ไม่ถูกต้อง: $TARGET"
  exit 1
}
SHORT=$(git rev-parse --short "$RESOLVED")

echo "▶ git checkout $SHORT"
git checkout "$RESOLVED" || { echo "❌ git checkout failed"; exit 1; }

echo "▶ restart uvicorn"
kill $(lsof -ti:$PORT) 2>/dev/null
sleep 2
source .venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port $PORT > "$LOG" 2>&1 &
echo "→ uvicorn restarted (port $PORT)"
sleep 5

echo "▶ health check ×3"
ok=1
for i in 1 2 3; do
  sleep 3
  code=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" --max-time 5)
  echo "  health #$i → HTTP $code"
  [ "$code" != "200" ] && ok=0
done

if [ "$ok" = "1" ]; then
  echo "✅ Rollback สำเร็จ — อยู่ที่ commit $SHORT"
  exit 0
fi

echo "❌ ต้องดูแบบ manual (logs: $LOG)"
exit 1
