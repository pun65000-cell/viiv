#!/bin/bash
PROD=9000
DEV=8000
APP_DIR=/home/viivadmin/viiv
LOG=$APP_DIR/logs/deploy.log

echo "[$(date)] === ROLLBACK START ===" | tee -a $LOG

if [ ! -z "$1" ]; then
  cd $APP_DIR && git checkout $1
  echo "Rolled back to: $1" | tee -a $LOG
fi

# Caddy → DEV :8000 (เวอร์ชันเก่า)
sudo sed -i "s/reverse_proxy localhost:$PROD/reverse_proxy localhost:$DEV/g" /etc/caddy/Caddyfile
sudo sed -i "s/reverse_proxy 127.0.0.1:$PROD/reverse_proxy 127.0.0.1:$DEV/g" /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
echo "Caddy → DEV :$DEV" | tee -a $LOG

echo "[$(date)] === ROLLBACK DONE ===" | tee -a $LOG
