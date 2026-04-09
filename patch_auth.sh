#!/bin/bash
set -e
VIIV=~/viiv

echo "=== [1/4] เปิด requireAuth ใน dashboard.html ==="
sed -i "s|// import { requireAuth } from \"./core/auth.js\";|import { requireAuth, logout } from \"./core/auth.js\";|g" \
  "$VIIV/frontend/platform/dashboard.html"
sed -i "s|// if (!requireAuth()) return;|if (!requireAuth()) return;|g" \
  "$VIIV/frontend/platform/dashboard.html"

echo "=== [2/4] logout จริง ==="
sed -i "s|if (confirm('ออกจากระบบ?')) location.href = '/platform/login.html';|if (confirm('ออกจากระบบ?')) logout();|g" \
  "$VIIV/frontend/platform/dashboard.html"

echo "=== [3/4] แก้ bug password_hash → hashed_password ==="
sed -i "s|u\.password_hash|u.hashed_password|g" \
  "$VIIV/app/api/admin_auth.py"

echo "=== [4/4] ลบ login ซ้ำ ==="
rm -f "$VIIV/frontend/login.html"
rm -f "$VIIV/frontend/owner/login.html"

echo "✅ เสร็จ"