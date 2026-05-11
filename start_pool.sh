#!/bin/bash
# start_pool.sh — launch modulepool :8010
set -e

cd /home/viivadmin/viiv

if ss -tlnp 2>/dev/null | grep -q ":8010"; then
    echo "ERROR: port 8010 still in use"
    exit 1
fi

source .venv/bin/activate

setsid nohup python -m uvicorn modulepool.main:app \
    --host 0.0.0.0 --port 8010 \
    > logs/pool.log 2>&1 < /dev/null &
disown

sleep 3

if curl -s -f http://localhost:8010/health > /dev/null; then
    echo "✅ modulepool started on :8010"
    echo "PID: $(pgrep -f 'modulepool.main:app')"
else
    echo "❌ modulepool failed to start — check logs/pool.log"
    tail -20 logs/pool.log
    exit 1
fi
