#!/bin/bash

MODE_FILE="AI_MODE.txt"

if [ ! -f "$MODE_FILE" ]; then
  echo "❌ AI_MODE.txt not found. Run AI_CONTROL first."
  exit 1
fi

MODE=$(grep MODE $MODE_FILE | cut -d '=' -f2)
LIMIT=$(grep MAX_LINES $MODE_FILE | cut -d '=' -f2)

RULE=""

if [ "$MODE" = "DEBUG" ]; then
  RULE="MODIFY ONLY (NO REWRITE)"
elif [ "$MODE" = "BUILD" ]; then
  RULE="FULL BUILD ALLOWED"
elif [ "$MODE" = "BYPASS" ]; then
  RULE="SAFE PATCH ONLY"
fi

TASK="$1"

echo "================ PROMPT ================"

echo "READ FIRST (MANDATORY - STOP IF NOT READ):"
echo "/home/viivadmin/viiv/AI_RULES.md"
echo "/home/viivadmin/viiv/v-infra.md"
echo "IF FILES NOT READ → STOP EXECUTION"
echo ""

echo "MODE: $MODE"
echo "LIMIT: $LIMIT"
echo "RULE: $RULE"
echo ""

echo "TASK:"
echo "$TASK"
echo ""

echo "CONSTRAINT:"
echo "- Do NOT break existing UI"
echo "- Keep layout unchanged"
echo "- Minimal change only (if DEBUG/BYPASS)"
echo ""

echo "OUTPUT:"
echo "- Show exact changes"
echo "- No explanation"
echo "========================================"
