#!/bin/bash
APP_DIR=/home/viivadmin/viiv
LOG=$APP_DIR/logs/deploy.log

# detect current ACTIVE port from Caddyfile (skip moduleai/modulechat ports)
ACTIVE=$(grep -oP "reverse_proxy localhost:\K[0-9]+" /etc/caddy/Caddyfile | grep -v "8003\|8002" | head -1)
FALLBACK=$([ "$ACTIVE" = "9000" ] && echo 8000 || echo 9000)

echo "[$(date)] === ROLLBACK START — ACTIVE=:$ACTIVE FALLBACK=:$FALLBACK ===" | tee -a $LOG

if [ -z "$ACTIVE" ] || [ -z "$FALLBACK" ]; then
  echo "FATAL — could not detect ACTIVE port from Caddyfile" | tee -a $LOG
  exit 1
fi

# optional: checkout an earlier commit before restoring service
if [ ! -z "$1" ]; then
  cd $APP_DIR && git checkout $1
  echo "Rolled back to: $1" | tee -a $LOG
fi

# ensure FALLBACK has a process (deploy.sh kills the old port at end of run)
source $APP_DIR/.venv/bin/activate
if ! lsof -ti:$FALLBACK >/dev/null 2>&1; then
  echo "FALLBACK :$FALLBACK is down — starting" | tee -a $LOG
  nohup uvicorn app.main:app --host 0.0.0.0 --port $FALLBACK \
    > $APP_DIR/logs/uvicorn-$FALLBACK.log 2>&1 &
  sleep 4
fi

# Caddy switch ACTIVE → FALLBACK
sudo sed -i "s/reverse_proxy localhost:$ACTIVE/reverse_proxy localhost:$FALLBACK/g" /etc/caddy/Caddyfile
sudo sed -i "s/reverse_proxy 127.0.0.1:$ACTIVE/reverse_proxy 127.0.0.1:$FALLBACK/g" /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
echo "Caddy switched :$ACTIVE → :$FALLBACK" | tee -a $LOG

echo "[$(date)] === ROLLBACK DONE — now serving :$FALLBACK ===" | tee -a $LOG
