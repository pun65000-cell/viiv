#!/usr/bin/env bash
# Rule 193: setsid + nohup + disown pattern
pkill -f "modulefbchat.main:app" 2>/dev/null || true
sleep 1
cd /home/viivadmin/viiv && source .venv/bin/activate
setsid nohup python -m uvicorn modulefbchat.main:app \
  --host 0.0.0.0 --port 8006 \
  > logs/fbchat.log 2>&1 < /dev/null & disown
sleep 2
curl -s http://localhost:8006/health
