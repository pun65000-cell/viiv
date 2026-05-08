#!/bin/bash
# Asset cache buster — bumps ?v=XXXX in all HTML files
# Run after any frontend code change before testing in browser

set -euo pipefail

V=$(date +%s | tail -c 5)
ROOT=/home/viivadmin/viiv

# All HTML files that may contain ?v= asset references
TARGETS=(
  "$ROOT/frontend/pwa/index.html"
  "$ROOT/frontend/login.html"
  "$ROOT/frontend/register.html"
  "$ROOT/frontend/register-success.html"
  "$ROOT/modulechat/ui/dashboard/index.html"
)

# Glob patterns — ครอบทุกไฟล์ HTML ใน folder เหล่านี้
GLOB_DIRS=(
  "$ROOT/frontend/pwa"
  "$ROOT/frontend/superboard"
  "$ROOT/frontend/platform"
  "$ROOT/modules/pos/merchant/ui"
  "$ROOT/modulechat/ui"
)

count=0
declare -A seen

# Static targets
for f in "${TARGETS[@]}"; do
  if [ -f "$f" ] && grep -q '?v=[0-9]*"' "$f"; then
    sed -i "s/?v=[0-9]*\"/?v=$V\"/g" "$f"
    seen["$f"]=1
    count=$((count + 1))
  fi
done

# Glob — find HTML files containing ?v=N pattern
for d in "${GLOB_DIRS[@]}"; do
  if [ -d "$d" ]; then
    while IFS= read -r f; do
      if [ -z "${seen[$f]:-}" ]; then
        sed -i "s/?v=[0-9]*\"/?v=$V\"/g" "$f"
        seen["$f"]=1
        count=$((count + 1))
      fi
    done < <(grep -rl '?v=[0-9]*"' "$d" --include='*.html' 2>/dev/null || true)
  fi
done

echo "✅ bumped $count files to ?v=$V"
