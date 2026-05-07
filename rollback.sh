#!/bin/bash
# rollback.sh — revert commit + redeploy DEV
# ไม่ใช่การสลับ port — ใช้ git checkout + redeploy DEV (:8000) แทน

set -e
cd /home/viivadmin/viiv

COMMIT=${1:-HEAD~1}
echo "⏪ Rolling back to: $COMMIT"

git checkout $COMMIT
~/viiv/deploy.sh
