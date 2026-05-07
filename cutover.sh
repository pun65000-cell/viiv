#!/bin/bash
# cutover.sh — สลับทุก LIVE block ใน Caddyfile ไปยัง port ใหม่
# ใช้เมื่อ Phase ใหม่เสร็จและพร้อม release ให้ลูกค้า
# ⚠️ จะกระทบลูกค้าทันที — ต้อง verify บน dev7 ก่อนเสมอ
#
# Mapping rule (after standardize 2026-05-07):
#   LIVE blocks (port เดียวกันเสมอ): test7 / concore / *.viiv.me /
#                                     auth / viiv (apex) / merchant / api
#   DEV block:  dev7.viiv.me            → port อีกฝั่ง
#
# convention: ทุก LIVE block ใช้ `reverse_proxy localhost:PORT` แบบเดียว
#             (merchant.viiv.me normalize 127.0.0.1: → localhost: แล้ว)

set -e
CADDYFILE=/etc/caddy/Caddyfile

# Detect current LIVE port from test7 block
CURRENT_PROD=$(awk '/^test7\.viiv\.me/,/^}/' $CADDYFILE | grep -oP "reverse_proxy localhost:\K[0-9]+" | grep -v "8003" | head -1)
NEW_PROD=$([ "$CURRENT_PROD" = "9000" ] && echo "8000" || echo "9000")
NEW_DEV=$CURRENT_PROD

# LIVE blocks ที่ swap พร้อมกัน (sed range patterns)
LIVE_BLOCKS=(
  '^test7\.viiv\.me'
  '^concore\.viiv\.me'
  '^auth\.viiv\.me'
  '^viiv\.me'
  '^merchant\.viiv\.me'
  '^api\.viiv\.me'
  '^\*\.viiv\.me'
)

echo "📊 Current state:"
echo "  LIVE  (test7/concore/auth/viiv/merchant/api/*.viiv.me) → :$CURRENT_PROD"
echo "  DEV   (dev7.viiv.me)                                    → :$NEW_PROD"
echo ""
echo "🔄 Cutover plan:"
echo "  LIVE  → :$NEW_PROD ← swap"
echo "  DEV   → :$NEW_DEV ← swap"
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

# 3-pass swap with __TMP__ sentinel.
# Pass 1: All LIVE blocks: CURRENT_PROD → __TMP__
# Pass 2: dev7: NEW_PROD → NEW_DEV (= old prod port)
# Pass 3: All LIVE blocks: __TMP__ → NEW_PROD
SED_ARGS=()
for blk in "${LIVE_BLOCKS[@]}"; do
  SED_ARGS+=( -e "/${blk}/,/^}/ s/reverse_proxy localhost:$CURRENT_PROD/reverse_proxy localhost:__TMP__/" )
done
SED_ARGS+=( -e "/^dev7\.viiv\.me/,/^}/ s/reverse_proxy localhost:$NEW_PROD/reverse_proxy localhost:$NEW_DEV/" )
for blk in "${LIVE_BLOCKS[@]}"; do
  SED_ARGS+=( -e "/${blk}/,/^}/ s/reverse_proxy localhost:__TMP__/reverse_proxy localhost:$NEW_PROD/" )
done

sudo sed -i "${SED_ARGS[@]}" $CADDYFILE

sudo caddy validate --config $CADDYFILE
sudo systemctl reload caddy

echo "✅ Cutover complete"
echo "  LIVE  → :$NEW_PROD"
echo "  DEV   → :$NEW_DEV"
echo ""
echo "🔍 Verify: for d in test7 concore dev7; do curl -sI https://\$d.viiv.me/api/platform/health | head -1; done"
echo "💡 Old prod (:$CURRENT_PROD) ยังรันอยู่ — kill เมื่อแน่ใจว่า cutover stable"
echo "💡 Run ./deploy.sh เพื่อ pull โค้ดใหม่ลง :$NEW_DEV (DEV port ใหม่)"
