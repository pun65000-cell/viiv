#!/bin/bash
set -e
APP_DIR=/home/viivadmin/viiv
LOG=$APP_DIR/logs/deploy.log

# detect current ACTIVE port from Caddyfile (skip moduleai/modulechat ports)
ACTIVE=$(grep -oP "reverse_proxy localhost:\K[0-9]+" /etc/caddy/Caddyfile | grep -v "8003\|8002" | head -1)
STAGING=$([ "$ACTIVE" = "9000" ] && echo 8000 || echo 9000)

echo "[$(date)] === DEPLOY START — ACTIVE=:$ACTIVE STAGING=:$STAGING ===" | tee -a $LOG

if [ -z "$ACTIVE" ] || [ -z "$STAGING" ]; then
  echo "FATAL — could not detect ACTIVE port from Caddyfile" | tee -a $LOG
  exit 1
fi

cd $APP_DIR
git pull origin main | tee -a $LOG
source $APP_DIR/.venv/bin/activate

# 1. start STAGING with new code
kill $(lsof -ti:$STAGING) 2>/dev/null || true
sleep 1
nohup uvicorn app.main:app --host 0.0.0.0 --port $STAGING \
  > $APP_DIR/logs/uvicorn-$STAGING.log 2>&1 &
sleep 4

# 2. health check STAGING (local — Caddy still on ACTIVE)
SUCCESS=0
for i in 1 2 3; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$STAGING/api/platform/health)
  echo "Health check STAGING :$STAGING #$i: $CODE" | tee -a $LOG
  if [ "$CODE" = "200" ]; then SUCCESS=1; break; fi
  sleep 5
done

if [ $SUCCESS -eq 0 ]; then
  echo "STAGING :$STAGING health failed — abort, ACTIVE :$ACTIVE still serving" | tee -a $LOG
  exit 1
fi

# 3. Caddy switch ACTIVE → STAGING
sudo sed -i "s/reverse_proxy localhost:$ACTIVE/reverse_proxy localhost:$STAGING/g" /etc/caddy/Caddyfile
sudo sed -i "s/reverse_proxy 127.0.0.1:$ACTIVE/reverse_proxy 127.0.0.1:$STAGING/g" /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
echo "Caddy switched :$ACTIVE → :$STAGING" | tee -a $LOG

# 4. verify domain serves new code
sleep 2
PROD_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://concore.viiv.me/api/platform/health)
echo "Domain health: $PROD_CODE" | tee -a $LOG

if [ "$PROD_CODE" != "200" ]; then
  echo "Domain failed — auto-rollback Caddy → :$ACTIVE" | tee -a $LOG
  sudo sed -i "s/reverse_proxy localhost:$STAGING/reverse_proxy localhost:$ACTIVE/g" /etc/caddy/Caddyfile
  sudo sed -i "s/reverse_proxy 127.0.0.1:$STAGING/reverse_proxy 127.0.0.1:$ACTIVE/g" /etc/caddy/Caddyfile
  sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
  exit 1
fi

# 5. kill old ACTIVE (Caddy no longer routes to it)
kill $(lsof -ti:$ACTIVE) 2>/dev/null || true
echo "Killed old :$ACTIVE" | tee -a $LOG

echo "[$(date)] === DEPLOY SUCCESS — now serving :$STAGING ===" | tee -a $LOG
