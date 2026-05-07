#!/bin/bash
# cutover.sh — สลับ test7.viiv.me + concore.viiv.me ไปยัง port ใหม่
# ใช้เมื่อ Phase ใหม่เสร็จและพร้อม release ให้ลูกค้า
# ⚠️ จะกระทบลูกค้าทันที — ต้อง verify บน dev7 ก่อนเสมอ
#
# Mapping rule:
#   test7.viiv.me   = LIVE  → port เดียวกับ concore (เสมอ)
#   concore.viiv.me = LIVE  → port เดียวกับ test7
#   dev7.viiv.me    = DEV   → port อีกฝั่ง

set -e
CADDYFILE=/etc/caddy/Caddyfile

CURRENT_PROD=$(awk '/^test7\.viiv\.me/,/^}/' $CADDYFILE | grep -oP "reverse_proxy localhost:\K[0-9]+" | grep -v "8003" | head -1)
NEW_PROD=$([ "$CURRENT_PROD" = "9000" ] && echo "8000" || echo "9000")
NEW_DEV=$CURRENT_PROD

echo "📊 Current state:"
echo "  test7.viiv.me   (LIVE) → :$CURRENT_PROD"
echo "  concore.viiv.me (LIVE) → :$CURRENT_PROD"
echo "  dev7.viiv.me    (DEV)  → :$NEW_PROD"
echo ""
echo "🔄 Cutover plan:"
echo "  test7.viiv.me   (LIVE) → :$NEW_PROD ← swap"
echo "  concore.viiv.me (LIVE) → :$NEW_PROD ← swap"
echo "  dev7.viiv.me    (DEV)  → :$NEW_DEV ← swap"
echo ""

read -p "⚠️  Cutover ลูกค้าจริง! ยืนยัน? (yes/N): " confirm
if [ "$confirm" != "yes" ]; then
  echo "❌ Cancelled"
  exit 1
fi

echo "🔍 Verifying :$NEW_PROD health..."
if ! curl -sf "http://localhost:$NEW_PROD/api/platform/health" > /dev/null; then
  echo "❌ :$NEW_PROD ไม่ healthy — abort cutover"
  exit 1
fi

sudo cp $CADDYFILE $CADDYFILE.backup.$(date +%Y%m%d_%H%M%S)

# 3-pass swap with __TMP__ sentinel:
# - test7 + concore: CURRENT_PROD → __TMP__ → NEW_PROD
# - dev7: NEW_PROD → NEW_DEV (= old prod port)
sudo sed -i \
  -e "/^test7\.viiv\.me/,/^}/ s/reverse_proxy localhost:$CURRENT_PROD/reverse_proxy localhost:__TMP__/" \
  -e "/^concore\.viiv\.me/,/^}/ s/reverse_proxy localhost:$CURRENT_PROD/reverse_proxy localhost:__TMP__/" \
  -e "/^dev7\.viiv\.me/,/^}/ s/reverse_proxy localhost:$NEW_PROD/reverse_proxy localhost:$NEW_DEV/" \
  -e "/^test7\.viiv\.me/,/^}/ s/reverse_proxy localhost:__TMP__/reverse_proxy localhost:$NEW_PROD/" \
  -e "/^concore\.viiv\.me/,/^}/ s/reverse_proxy localhost:__TMP__/reverse_proxy localhost:$NEW_PROD/" \
  $CADDYFILE

sudo caddy validate --config $CADDYFILE
sudo systemctl reload caddy

echo "✅ Cutover complete"
echo "  test7.viiv.me   (LIVE) → :$NEW_PROD"
echo "  concore.viiv.me (LIVE) → :$NEW_PROD"
echo "  dev7.viiv.me    (DEV)  → :$NEW_DEV"
echo ""
echo "🔍 Verify production: curl -I https://test7.viiv.me"
echo "💡 Old prod (:$CURRENT_PROD) ยังรันอยู่ — kill เมื่อแน่ใจว่า cutover stable"
echo "💡 Run ./deploy.sh เพื่อ pull โค้ดใหม่ลง :$NEW_DEV (DEV port ใหม่)"
