#!/bin/bash
set -e
PROD=9000
DEV=8000
APP_DIR=/home/viivadmin/viiv
LOG=$APP_DIR/logs/deploy.log

echo "[$(date)] === DEPLOY START ===" | tee -a $LOG

cd $APP_DIR
git pull origin main | tee -a $LOG
source $APP_DIR/.venv/bin/activate

# restart DEV :8000 ก่อน (staging)
kill $(lsof -ti:$DEV) 2>/dev/null || true
sleep 1
nohup uvicorn app.main:app --host 0.0.0.0 --port $DEV \
  > $APP_DIR/logs/uvicorn-dev.log 2>&1 &
sleep 4

# health check DEV
SUCCESS=0
for i in 1 2 3; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$DEV/api/platform/health)
  echo "Health check DEV $i: $CODE" | tee -a $LOG
  if [ "$CODE" = "200" ]; then SUCCESS=1; break; fi
  sleep 5
done

if [ $SUCCESS -eq 0 ]; then
  echo "DEV health failed — abort, PROD :$PROD still running" | tee -a $LOG
  exit 1
fi

# switch Caddy DEV → PROD
sudo sed -i "s/reverse_proxy localhost:$PROD/reverse_proxy localhost:SWAP/g" /etc/caddy/Caddyfile
sudo sed -i "s/reverse_proxy localhost:$DEV/reverse_proxy localhost:$PROD/g" /etc/caddy/Caddyfile
sudo sed -i "s/reverse_proxy localhost:SWAP/reverse_proxy localhost:$DEV/g" /etc/caddy/Caddyfile
sudo sed -i "s/reverse_proxy 127.0.0.1:[0-9]*/reverse_proxy 127.0.0.1:$PROD/g" /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
echo "Caddy switched → PROD :$PROD" | tee -a $LOG

# start PROD :9000 ด้วย code ใหม่
kill $(lsof -ti:$PROD) 2>/dev/null || true
sleep 1
nohup uvicorn app.main:app --host 0.0.0.0 --port $PROD \
  > $APP_DIR/logs/uvicorn-green.log 2>&1 &
sleep 4

# health check PROD via domain
PROD_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://concore.viiv.me/api/platform/health)
echo "PROD health: $PROD_CODE" | tee -a $LOG

if [ "$PROD_CODE" != "200" ]; then
  echo "PROD failed — rollback!" | tee -a $LOG
  sudo sed -i "s/reverse_proxy localhost:$PROD/reverse_proxy localhost:$DEV/g" /etc/caddy/Caddyfile
  sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
  exit 1
fi

echo "[$(date)] === DEPLOY SUCCESS — PROD :$PROD ===" | tee -a $LOG
