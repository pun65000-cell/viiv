# VIIV STATE — Runtime Snapshot
> Version: **v3.9** | Updated: 2026-05-16
> ⛔ AI/Claude Code ห้ามแก้ไฟล์นี้โดยตรง — user copy paste manual

═══════════════════════════════════════════════════════════════
CURRENT STATE — 2026-05-16 (AI Prompt Layering + Business Paradigm)
═══════════════════════════════════════════════════════════════

## Active services
PRODUCTION : test7.viiv.me  → :8000 (ten_1/iAM_Food @749wyqfy) ✅
DEV/STAGE  : dev7.viiv.me   → :9000 (test_dev, OA dev เทส)      ✅
ADMIN      : concore.viiv.me → :8000                            ✅
LANDING    : viiv.me        → :8000                             ✅

Modules:
  modulechat :8003 ✅
  moduleai   :8002 ✅ ⚠️ SHARED prod+dev (PID 1005452, restart 16 พ.ค.)
  app        :8000 (PID 1005505) + :9000

## Git state
branch: main
HEAD local: b124691 (chore bump Phase 2)
origin/main: 37593bf  ← ⚠️ ยังไม่ push (CGO รัน push เอง)

commit chain (local — ปลอดภัย):
  b124691 chore(bump) Phase 2 cache version
  8f6ea14 Phase 2.5 prohibit editor
  985b426 fix tuple 2-tuple (Phase 2.4 fix)
  edf5df1 Phase 2.4 4-zone + keyword-scan
  eaee07a Phase 2.3 UI 3 box
  9942780 Phase 2.2 settings API
  09c6a4f Phase 1 persona injection

tag restore points:
  pre-persona-fix-20260516-042158
  pre-phase2.2-20260516-051022
  pre-phase2.3-20260516-051508
  pre-phase2.4-20260516-052404
  pre-phase2.5-20260516-054340

Pending commit (CGO copy paste เอง — FILE SAFETY):
  - VIIV_MASTER.md v6.5 (clean rewrite — ไฟล์ใหม่)
  - VIIV_STATE.md v3.9 (ไฟล์นี้)

═══════════════════════════════════════════════════════════════
SESSION 2026-05-16 — สรุปครบ
═══════════════════════════════════════════════════════════════

## งานหลัก: AI Prompt Layering (Phase 1 + Phase 2 ครบ)

ปัญหาเข้ามา: AI chat dev7 ไม่ยึด persona (ตอบ "ค่ะ" ทั้งที่ตั้ง male)

Recon เจอ 4 DEFECTS:
  1. {tenant_name} ค้าง literal (ไม่มี .replace())
  2. persona bypass (brain_prompt != None)
  3. persona 2-namespace ไม่ตรง (professional-male ↔ male_2)
  4. _ai_push_reply ไม่ query tenant (ROOT CAUSE)

## Phase 1 — persona injection ✅
  - persona.py: PERSONA_ALIAS + resolve_persona
  - db.py: get_brain_prompt subs= substitution
  - main.py: ChatIn +fields, ZONE 1 identity inject
  - pos_line.py: _ai_push_reply query tenant → payload
  commit 09c6a4f → (rollback ทับ working tree) → กู้ → restart :9000
  verified dev7: test_dev ตอบ "ครับ" + รู้บริบทร้าน ✅

## Phase 2 — full layering ✅ (5 sub-phase)
  2.1 DDL ai_prompts.prohibit_text (Dashboard)
  2.2 tenant_settings.py do/dont/safety (9942780)
  2.3 store-settings.html UI 3 box สี (eaee07a)
  2.4 moduleai 4-zone + keyword-scan (edf5df1)
      → bug tuple unpack → fix 985b426 (2-tuple ทุก path)
  2.5 concore prohibit editor (8f6ea14)
  verified dev7 (test_dev 3 เคส screenshot):
    "มีผัก" → ตอบปกติ+ครับ | "COD" → QR only | "ยา" → ปฏิเสธ ✅

## Deploy prod ✅ (technical)
  pre-flight 6 gate ผ่าน (working tree clean + commit bump b124691)
  restart :8002 + :8000 พร้อมกัน — log "startup complete"
  ไม่มี traceback/ValueError
  health: test7 200, concore 200, moduleai ok

## 🔴 Paradigm shift (CGO decision)
  D185: family-and-friends → ธุรกิจเต็มรูปแบบ
  (นิติบุคคล + Official API + ต้นทุนแฝงจริงสูง)
  → Law 10 ปรับ: tech debt = business liability
  → Law 15 NEW: verify method ต้องเขียนชัด (D186)
  บันทึกใน MASTER v6.5 (clean rewrite)

## Session lessons (กัน loop ซ้ำ)
  - working tree ถูก git checkout ทับ → :9000 code ผิด (Rule 427)
  - tuple unpack: syntax OK แต่ runtime crash (D187 — pre-check จับ)
  - verify method ไม่เขียนชัด → AI guide ผิด 3 รอบ (Law 15)
  - emoji ใน pra-prompt → Claude Code ค้าง (Rule 55 ขยาย)
  - bump uncommitted → working tree ไม่ clean (Rule 428)

═══════════════════════════════════════════════════════════════
🔴 CGO ACTIONS REQUIRED
═══════════════════════════════════════════════════════════════

## NOW

P0  git push origin main
    cd /home/viivadmin/viiv
    git push origin main
    # verify: git log --oneline -1 origin/main → ต้อง = b124691

P0  Update docs (FILE SAFETY — copy เอง)
    1. แทนที่ VIIV_MASTER.md ด้วยไฟล์ v6.5 ใหม่ทั้งไฟล์
       (clean rewrite — ไม่ใช่ append)
    2. แทนที่ VIIV_STATE.md ด้วย v3.9 (ไฟล์นี้)
    git add VIIV_MASTER.md VIIV_STATE.md
    git commit -m "docs: MASTER v6.5 + STATE v3.9 -- business paradigm
    + AI prompt layering Phase 1+2 implemented"
    git push origin main

## 🔴 Next session (P0 — แก้ปมปวดหัว)

P0  สร้าง ~/viiv/verify_chat.sh (Law 15, D186)
    - รับ arg tenant_id (test_dev | ten_1)
    - ค้นจาก code จริงว่า chat flow ทำงานยังไง
    - ส่ง test + query chat_messages + moduleai.log
    - print PASS/FAIL
    → ลบความปวดหัว "verify ยังไง" ถาวร
    → ตกผลึก verify method prod (ten_1) ที่ยังไม่ชัด

P0  verify prod ten_1 (รอ verify_chat.sh หรือ manual)
    คาดหวัง: professional-female → "ค่ะ" + 4-zone + biz_type
    (ปัจจุบัน prod restart code ใหม่แล้ว แต่ยังไม่ confirm
     ด้วย message จริง — code โหลดได้ไม่ crash)

## This week

P1  NodeMaven credential rotation (D145 — ค้างนาน)
P1  Phase 3 Bot tools (search_products/affiliate, on-demand)
P2  Strategic review: ธุรกิจ paradigm (D185)
    → re-architect tech debt อะไร (session สดๆ ไม่ใช่ปลาย session)
P2  email privacy@/support@ (ก่อน App Review)

## Scheduled

~2026-05-28  cleanup backups
~2026-06-14  DROP fb_sessions + fb_audit_log (Dashboard)

═══════════════════════════════════════════════════════════════
TECH DEBT (v6.5 — business liability mindset)
═══════════════════════════════════════════════════════════════

## P0
- verify method prod (ten_1) ไม่ตกผลึก → CGO ปวดหัวซ้ำ
- verify_chat.sh ยังไม่สร้าง
- prod ten_1 ยังไม่ confirm verify (code โหลดได้แต่ไม่ test จริง)

## P1
- :8002 SHARED prod+dev → restart มือ (re-architect: dev :8012?)
- NodeMaven credential (D145 pending นาน)
- git push pending (local ปลอดภัย แต่ยังไม่ off-site จนกว่า push)

## P2
- MASTER เคย 426 rules → v6.5 condensed (รักษา lean ต่อ)
- ai_token_log slot column ยังไม่มี
- modulepool dormant | fb_sessions DROP queued
- ai-bot.html CRUD ยังไม่ทดสอบจริง

## P3
- email privacy@/support@ ยังไม่ setup
- Phase 4 logo upload ยังไม่ทดสอบ
- BILLING_GUARD_MODE=report (ยังไม่ enforce)

═══════════════════════════════════════════════════════════════
NEXT TURN HANDOFF
═══════════════════════════════════════════════════════════════

## เปิด session ใหม่
1. Copy VIIV_MASTER.md (v6.5) + VIIV_STATE.md (v3.9) → AI chat
2. ps aux | grep claude | grep -v grep → kill เก่า

## สถานะสั้นที่สุด (เผื่อไม่อยากอ่านยาว)
```
✅ Phase 1+2 AI prompt layering — code commit + verified dev7
🟡 prod ten_1 — restart code ใหม่แล้ว แต่ยังไม่ verify message จริง
🔴 ทำ verify_chat.sh ก่อน (แก้ปม CGO ปวดหัวซ้ำ — Law 15)
🔴 git push (ถ้ายังไม่ทำ NOW)
🔴 docs MASTER v6.5 + STATE v3.9 (ถ้ายังไม่ commit)
```

## Health check
```bash
curl -s http://localhost:8002/health   # moduleai (SHARED)
curl -s http://localhost:8003/health   # modulechat
curl -sS -o /dev/null -w "test7 %{http_code}\n" \
  https://test7.viiv.me/api/platform/health
curl -sS -o /dev/null -w "dev7 %{http_code}\n" \
  https://dev7.viiv.me/api/platform/health
psql postgresql://postgres:viiv_secure_123@10.1.0.3:5434/postgres -c \
  "SELECT id,store_name,ai_persona,jsonb_pretty(ai_context)
   FROM tenants WHERE id IN ('ten_1','test_dev');"
```

## Quick reference
- LINE API: https://developers.line.biz/en/reference/messaging-api/
- ai_prompts.prohibit_text DDL (ทำแล้ว 2.1):
  ALTER TABLE ai_prompts ADD COLUMN IF NOT EXISTS
    prohibit_text text NOT NULL DEFAULT '';

═══════════════════════════════════════════════════════════════
END OF STATE v3.9
═══════════════════════════════════════════════════════════════
