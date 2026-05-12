#!/bin/bash
set -e
cd /home/viivadmin/viiv
source .venv/bin/activate
kill $(lsof -ti:8005) 2>/dev/null || true
sleep 1
nohup uvicorn modulecookie.main:app --host 0.0.0.0 --port 8005 > logs/cookie.log 2>&1 &
sleep 2
tail -5 logs/cookie.log
echo "modulecookie running on :8005"
