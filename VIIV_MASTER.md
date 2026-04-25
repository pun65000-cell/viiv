# VIIV MASTER — CGO Reference
> **copy ไฟล์นี้ทั้งหมดเพื่อเปิดแชทใหม่กับ CGO ทุกครั้ง**  
> Version: v1.42 | Updated: 2026-04-25  
> Claude Code อัปเดต Section [E] ทุกสิ้นวัน
---
[A] ROLE & WORKFLOW
บทบาท (v1.42)
```
CGO Chat    = Claude Pro subscription (แยกบัญชี) — architecture, decisions, MASTER.md
CTO Chat    = Claude Pro subscription — review, สั่ง Claude Code, เขียน spec ร่วม CGO
Claude Code = Pro subscription (same account as CTO) — implement ตาม spec
             ⚠️ ใช้บัญชีเดียวกับ CTO → นับ limit รวม แจ้ง CGO ที่ 80%
Terminal    = รับ pyeof จาก CGO โดยตรง — debug, grep, short scripts เท่านั้น
API Key     = debug only — ห้ามเขียนโค้ดใหม่
เจ้าของโปรเจกต์ = ส่ง spec ให้ CGO → CGO/CTO แปลงเป็น task → Claude Code implement
```
Daily Workflow
```
เช้า:     copy VIIV_MASTER.md ทั้งไฟล์ → เปิดแชทใหม่ → CGO เก็ต context 100%
ระหว่างวัน: CGO ออก spec → Claude Code implement → test
เย็น:     CGO สั่ง Claude Code: "สรุปวันนี้ เพิ่มใน VIIV_MASTER.md Section [E]"
พรุ่งนี้: copy ไฟล์ใหม่ → เปิดแชท → ทำต่อ
```
Execution Workflow (v1.42)
```
→ Claude Code (Pro)  = งานเขียนโค้ด implement, rewrite, feature ใหม่ทุกอย่าง
→ Terminal           = รันคำสั่งสั้น, debug, grep, pyeof จาก CGO โดยตรง
→ API Key            = debug only หลัง implement เสร็จ — ห้ามเขียนโค้ดใหม่
CGO/CTO ไม่เขียนโค้ดยาว — เขียนแต่ prompt, spec, และ review เท่านั้น
```
Model Policy
```
claude-haiku-4-5   → งานทั่วไป (edit, debug, < 100 บรรทัด)
claude-sonnet-4-6  → complex logic, multi-file, architecture
claude-opus        → ห้ามใช้ยกเว้น CGO อนุมัติ
```
Token Rules
```
Claude Code อ่านเฉพาะไฟล์ที่เกี่ยวกับ task นั้น
ถ้า task ต้อง read > 3 ไฟล์ → แจ้ง CGO ก่อน แบ่ง task
ห้าม loop/retry เกิน 3 ครั้งโดยไม่แจ้ง
ใช้ /compact ก่อนส่ง prompt ใหม่ทุกครั้ง
Rate limit 30,000 tokens/min → รอ 1 นาทีแล้วส่งใหม่
```
API Setup
```bash
# ~/.bashrc
export ANTHROPIC_API_KEY="sk-ant-api03-xxx"
alias claude-api="claude"

# รัน Claude Code
cd ~/viiv && claude
```
---
[B] ARCHITECTURE
Stack
```
Runtime:   FastAPI Python 3.12
Database:  Supabase / PostgreSQL (10.1.0.3:5434)
Proxy:     Caddy
Server:    Uvicorn port 8000
Path:      /home/viivadmin/viiv/
Domain:    concore.viiv.me
JWT:       21cc8b2ff8e25e6262effb2b47b15c39fb16438525b6d041bb842a130c08be7c
```
Auth Architecture
```
Auth หลัก: Superboard (m.viiv.me/superboard/mobile/)
PWA:       รับ token จาก Superboard ผ่าน postMessage
           ไม่มี login ตัวเอง — token มาจาก parent เสมอ
Fallback:  localStorage.getItem('viiv_token')
Dev token: ten_1/usr_1 (ชั่วคราว — ห้าม deploy production)
```
File Structure (v1.34)
```
/home/viivadmin/viiv/
├── .env
├── app/
│   ├── main.py
│   └── api/
│       ├── pos_bills.py       ✅ reserve flow + complete-reserve + delivery filter
│       ├── pos_members.py, pos_store.py
│       ├── pos_products.py, pos_categories.py
│       ├── pos_affiliate.py, pos_partners.py
│       ├── pos_receive.py, pos_line.py
│       ├── pos_line_settings.py, pos_bank.py
│       └── login.py
├── frontend/
│   ├── superboard/
│   │   ├── index.html              SPA shell (desktop)
│   │   ├── dashboard/              Living Dashboard (isolated iframe)
│   │   │   └── billing/
│   │   │       ├── reserve.html    ✅ ใบจอง list+edit+จบการขาย
│   │   │       ├── delivery.html   ✅ กำลังส่ง list+status modal
│   │   │       └── ...
│   │   ├── mobile/index.html       ✅ light theme + profile + PTR
│   │   └── pages/
│   └── pwa/                        PWA Shell — Phase 1 ✅ Done
│       ├── index.html
│       ├── manifest.json
│       ├── sw.js
│       ├── css/app.css             Design system v1.17
│       ├── js/router.js, app.js
│       └── pages/
│           ├── home.js             ✅ Living Dashboard + module cards
│           ├── pos.js              ✅ POS Hub + 9-menu + ออกบิล sub-sheet
│           ├── billing.js          ✅ ออกบิล + cart + payment sheet
│           ├── orders.js           ✅ list + filters
│           ├── orders-detail.js    ✅ detail + fin/ship status + upload
│           ├── orders-upload.js    ✅ upload slip helper
│           ├── products.js         ✅ CRUD + image upload + receive history
│           ├── members.js          ✅ list + search + tier badges
│           ├── store.js            ✅ 7 tabs
│           ├── more.js             ✅ navigation drawer
│           ├── chat.js             🚧 Phase 2
│           └── autopost.js         🚧 Phase 2
├── modulpos/    ← Legacy (อย่าแตะ)
├── modulechat/  ← Legacy foundation
└── modulepost/  ← Legacy foundation
```
Working Files (ห้ามสับสน)
```
Backend จริง:  app/api/pos_*.py       ✅
Frontend จริง: frontend/pwa/          ✅ (PWA mobile)
PC Dashboard:  modules/pos/merchant/ui/dashboard/  ✅
Legacy:        modulpos/ modulechat/ modulepost/  ❌ อย่าแตะ
Asset version: ?v=1175 (orders-detail) / ?v=1175 (orders)
```
DB Schema (fields สำคัญ)
```sql
-- bills table
doc_type: receipt | reserve | invoice | delivery | creditnote
status: pending | paid | credit | partial | voided
shipping_status: scheduled | shipped_no_recipient | shipped_cod |
                 shipped_collect | bill_check | chargeback |
                 overdue | delivery | received_payment
LOCK_SHIPPING = {'received_payment'}  -- เปลี่ยนไม่ได้

-- products table
stock_qty      numeric(12,2)  -- สต็อกจริง
stock_back     numeric        -- คลังหลังร้าน
stock_reserved numeric(12,2)  -- กันไว้สำหรับใบจอง ✅ เพิ่มแล้ว
track_stock    boolean
min_alert      numeric
```
API Endpoints
```
/api/pos/bills/*                    — bills CRUD
  POST /api/pos/bills/complete-reserve/{bid}  ✅ จบการขายใบจอง
  PATCH /api/pos/bills/update-reserve/{bid}   ✅ แก้ใบจอง + delta stock_reserved
/api/pos/products/*                 — products CRUD
/api/pos/categories/*               — categories CRUD
/api/pos/members/*                  — members CRUD
/api/pos/partners/*                 — partners CRUD
/api/pos/affiliate/*                — affiliate CRUD
/api/pos/store/*                    — store settings
/api/pos/bank/*                     — bank accounts
/api/pos/receive/*                  — stock receive
/api/pos/bills/upload-slip          — upload รูปสลิป
/api/line/*                         — LINE webhook
/api/pos/line/*                     — LINE settings
```
Module Architecture (v1.31)
```
Module       Blue (prod)  Green (staging)
───────────  ───────────  ───────────────
concore      :8000        :9000
modulpos     :8001        :9001  (future)
moduleai     :8002        :9002  (future)
modulebot    :8003        :9003  (future)
```
Quick Commands
```bash
# Restart server
kill $(lsof -ti:8000) 2>/dev/null && sleep 1
cd /home/viivadmin/viiv && source .venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > logs/uvicorn.log 2>&1 &
sleep 2 && tail -3 logs/uvicorn.log

# Test token
TOKEN=$(python3 -c "import jwt; print(jwt.encode({'tenant_id':'ten_1','user_id':'usr_1'}, '21cc8b2ff8e25e6262effb2b47b15c39fb16438525b6d041bb842a130c08be7c', algorithm='HS256'))")
curl -s http://localhost:8000/api/pos/partners/list -H "Authorization: Bearer $TOKEN"

# DB query
psql postgresql://postgres:viiv_secure_123@10.1.0.3:5434/postgres

# Reload Caddy
sudo systemctl reload caddy

# Realtime log
tail -f /home/viivadmin/viiv/logs/uvicorn.log
```
---
[C] DECISIONS LOG
```
#   Decision                                                          ยืนยันเมื่อ
1   Mobile → PWA (no iframe)                                          v1.14
2   Feature Flag: guard Frontend + Backend API                        v1.16
3   Feature Flag timing: หลัง PWA Phase 2 ก่อน Blue/Green            v1.16
4   UX locked: "ต้องการแพ็คเกจ Pro — ดูแพ็คเกจ →"                   v1.16
5   AI Framework: LiteLLM + Raw Anthropic SDK (ไม่ใช่ LangChain)     v1.31
6   AI Tier: haiku/sonnet/opus                                        v1.16
7   AI Cost: token budget per tenant + hard limit                     v1.16
8   AI Latency: POS=pre-cache, Chat=SSE, AutoPost=async               v1.16
9   POS Bot: Help Only — ห้าม action                                  v1.16
10  Claude Code model: haiku default, sonnet complex                  v1.17
11  Memory: CLAUDE.md (server) + VIIV_MASTER.md (CGO daily)          v1.17
12  Module split: concore/modulpos/moduleai/modulebot                 v1.31
13  Bot ≠ AI: modulebot = rule-based Q&A                              v1.31
14  Session memory: Redis (per tenant) ใน moduleai                   v1.31
15  Priority 1: health check + circuit breaker + quota table          v1.31
16  CGO workflow: ไม่เขียนโค้ดยาว — เขียนแต่ prompt/spec             v1.34
17  API key only บน server — Pro subscription ใช้กับ chat เท่านั้น  v1.34
18  reserve bill: stock_reserved กัน stock ไม่หัก stock_qty จริง     v1.34
19  LOCK_SHIPPING = received_payment เท่านั้น (ลบ debt ออก)          v1.34
20  billing_statements table ใหม่ แยกจาก bills                       v1.36
21  statement.js แยกไฟล์จาก HTML fix dashboard innerHTML inject       v1.36
22  Pro subscription ห้ามแก้ loadSubPage/dashboard mechanism          v1.36
23  model selection per task: haiku=CSS/debug, sonnet=multi-file      v1.36
24  3-mode system: delivered/cheque/appointment รวม negotiation_note  v1.37
25  upload flow 2-step: POST upload-slip → PATCH record               v1.37
26  bill_no standard: BILL-YYYY-XXXXXX เท่านั้น (server gen_bill_no()) v1.42
27  finalize-draft: DRAFT-{random} → gen_bill_no() ก่อน confirm      v1.42
28  /migrate disabled by default: MIGRATION_MODE=1 เปิดชั่วคราวเท่านั้น v1.42
29  legacy_ref field: เก็บ original client id ไว้เพื่อ traceability  v1.42
```
---
[D] KNOWN RULES & ISSUES
```
Rule 16 — Cloudflare Cache 404: /uploads/ ต้องมี Bypass Cache rule
Rule 17 — JS var scope: var ใน try{} → declare ที่ function scope บนสุด
Rule 18 — Caddyfile concore block ต้องมี /uploads/* handler แยก
Rule 19 — Mobile iframe back button: history.pushState() + popstate intercept
Rule 20 — iframe PTR: ทำไม่ได้ → แก้ถาวรด้วย PWA
Rule 21 — PWA PTR: เช็ค container.scrollTop === 0 ก่อน start pull
Rule 22 — ห้าม localStorage.removeItem('viiv_token') ยกเว้น explicit logout
Rule 23 — dashboard.html ต้องมี dev token bootstrap + Cache-Control: no-store
Rule 24 — Dev token (ten_1/usr_1) ชั่วคราว — ห้าม deploy ให้ลูกค้าจริง
Rule 25 — Field names ที่ถูกต้อง:
  vat ✅ | min_alert ✅ | stock_back ✅ | track_stock ✅ | pay_method ✅ | category ✅
Rule 26 — loadSubPage() ต้องมี AbortController + token guard (race condition fix)
Rule 27 — sheet handle onclick=closeSheet() ต้องมี เพื่อให้ลากปิด bottom sheet ได้
Rule 28 — activity log field: l.by (ไม่ใช่ l.user) — backend เก็บ "by": uid
Rule 29 — received_payment บังคับ upload รูปหลักฐานก่อน setShipStatus()
Rule 30 — reserve bill: ใช้ stock_reserved ไม่ใช่ stock_qty, complete-reserve จึงหักจริง
Rule 31 — delivery.html filter client-side จาก bills list (ไม่สร้าง endpoint ใหม่)
Rule 32 — Claude Code rate limit 30k/min → ถ้าติดให้รอ 1 นาที หรือส่ง prompt สั้นลง
Rule 33 — python3 EOF
Rule 35 — statement.html ต้องเป็น standalone HTML ห้ามแก้ loadSubPage() ใน dashboard.html
Rule 36 — ระบุชื่อไฟล์เป้าหมายใน prompt ทุกครั้ง ห้าม Claude Code อ่านไฟล์ที่ไม่เกี่ยว
Rule 37 — Pro subscription ห้ามแก้ dashboard loading mechanism — เสี่ยง regression ทุกเมนู
Rule 34 — ก่อนส่ง spec ทุกครั้ง ให้ Claude Code confirm path ด้วย:
  ls [path] 2>&1 && echo "PATH OK" || echo "PATH NOT FOUND" อย่าใช้ ! ใน string → ใช้ heredoc << 'EOF' แทน
Rule 45 — CGO ห้าม debug ทีละบรรทัดเอง → วิเคราะห์ root cause แล้วส่ง spec ให้ Claude Code
Rule 46 — CTO + Claude Code ใช้ Pro บัญชีเดียวกัน → นับ limit รวม แจ้ง CGO ที่ 80%
Rule 47 — billing/create.html: init ด้วย polling window.VIIV_TOKEN แทน _tok_ pattern (event อาจ fire ก่อน bind)
Rule 48 — bill_no ต้องมาจาก gen_bill_no() เสมอ ห้าม client ส่งมาตรงๆ
Rule 49 — DRAFT- prefix = ยังไม่ finalize ห้าม expose ลูกค้า → ต้องผ่าน /finalize-draft ก่อน
```
---
[E] PROGRESS
Current State
```
Version:      v1.34
Phase:        PWA Mobile Phase 1 ✅ Done → Phase 2 กำลังจะเริ่ม
              PC Dashboard: billing reserve + delivery ✅ Done
Last updated: 2026-04-25 (v1.36)
Git latest:   statement [1][2][3][4] search/cheque/appt/followup (2026-04-25, f952717)
```
PWA Pages Status
```
ไฟล์                                    สถานะ    หมายเหตุ
home.js                                 ✅ Done  Living Dashboard + module cards
pos.js                                  ✅ Done  POS Hub + 9-menu + ออกบิล sub-sheet
billing.js                              ✅ Done  ออกบิล + cart + payment sheet
orders.js / orders-detail.js / orders-upload.js  ✅ Done  split 3 files
products.js                             ✅ Done  CRUD + image upload + receive history
members.js                              ✅ Done  list + search + tier badges
store.js                                ✅ Done  7 tabs full parity
more.js                                 ✅ Done  navigation drawer
chat.js                                 🚧 Phase 2
autopost.js                             🚧 Phase 2
```
PC Dashboard Status
```
billing/reserve.html   ✅ Done  ใบจอง list+search+filter+modal+จบการขาย+ยกเลิก
billing/delivery.html  ✅ Done  กำลังส่ง list+search+filter+status modal+auto-remove
billing/reserve.html   ⚠️ TODO card size ใหญ่เกิน — ต้องลดขนาด + ปรับ UI แยกจากหน้าค้นหาบิล
```
Next Up (ลำดับ Priority — อัปเดต v1.42)
```
1. 🔴 HIGH — statement: แสดงรายละเอียดลูกค้าครบ (JOIN members realtime — ที่อยู่, tax_id, เบอร์)
2. 🔴 HIGH — create.html: search สินค้า ✅ แก้แล้ว (polling VIIV_TOKEN fix, Claude Code)
3. 🔴 HIGH — pos_line.py: LINE Webhook + pending-uid
4. 🟡 MED  — PWA billing: discount, VAT, doc type
5. 🟡 MED  — PWA members: add/edit form
6. 🟡 MED  — Dashboard API: ยอดแชท, Affiliate, AutoPost (real data)
7. 🟡 MED  — PWA Phase 2: easysale, affiliate, finance
8. 🟡 MED  — Feature Flag Schema + AI Quota Tables (DB)
9. 🟡 MED  — Blue-Green setup: สร้าง viiv-green + scripts
10. 🔵 FUT — PWA Phase 3: receive, settings
11. 🔵 FUT — Capacitor.js → APK/IPA
```
Completed Today (2026-04-25)
```
✅ statement [1][2][3][4] (commit f952717):
   - [1] LEFT SEARCH: พิมพ์ → fetch unpaid-bills?q= → checklist+checkbox ใน left panel
         ปุ่ม "สร้างใบวางบิลจากที่เลือก" (disabled ถ้าไม่มีเลือก)
         stLoad() clears search ทุกครั้ง; เคลียร์ → กลับ statement list
   - [2] CHEQUE: 15-bank dropdown + payee/payer/cheque_no/due_date + clear btn
         cheque_detail = JSON {bank,payee,payer,cheque_no,due_date}
   - [3] APPOINTMENT FIELDS: appointment_dt (datetime-local) + appointment_note (textarea)
         แสดงใน ปรับสถานะ section; บันทึกใน stSave payload
   - [4] ติดตามการชำระ section (status!=paid):
         due_single < today → bg แดง "เกินกำหนด"
         due_single >= today → bg เหลือง "รอชำระ"
         appointment_dt + appointment_note display

✅ statement [1][2][3] earlier (commit 03ab628):
   - CARD: search + card แสดง partner_name · contact_name
   - 2-action btn; stPickAction; _activeStmt; stHistoryModal

✅ delivery.html (commit 89bd450):
   - list filter client-side: scheduled/shipped_*/delivery/bill_check/chargeback
   - search + filter chip: ทั้งหมด | กำหนดส่ง | กำลังส่ง | COD
   - card: bill_no, ลูกค้า, ยอด, shipping badge, วันกำหนดส่ง, ship_note
   - modal: status grid 10 สถานะ + เลขพัสดุ + activity log
   - auto-remove เมื่อสถานะพ้น shipped group

✅ reserve.html (commit ac5ad6f):
   - list, search, filter status, detail modal, edit, จบการขาย, ยกเลิก
   - stock_reserved logic: กัน stock ตอนจอง, คืนตอนยกเลิก, หักจริงตอนจบ

✅ DB Migration:
   - products.stock_reserved numeric(12,2) DEFAULT 0 ✅ applied

✅ pos_bills.py (commit ac5ad6f, bb827e0):
   - create_bill reserve: status=pending, เพิ่ม stock_reserved (ไม่หัก stock_qty)
   - POST /complete-reserve/{bid}: หัก stock_qty + ลด stock_reserved + paid/receipt
   - PATCH /update-reserve/{bid}: แก้ items + delta stock_reserved
   - void reserve: release stock_reserved

✅ orders-detail.js (v1175):
   - received_payment: upload section + บังคับรูปก่อนบันทึก
   - activity log: l.by แทน l.user
   - shipped_collect สีฟ้าอมเขียว (#cffafe/#0e7490) แยกจาก shipped_cod

✅ Navigation/Back fix (router.js v1168):
   - popstate ใช้ e.state แทน Router.stack
   - back() → history.back()
   - init() restore จาก hash จริง

✅ Caddy fix:
   - concore.viiv.me /pwa/* → try_files → index.html (reload บน mobile ถูกต้อง)

✅ dashboard.html fixes:
   - Sub-tab restore from hash (#page/tabIndex)
   - Race condition: AbortController + token guard
   - Products/Store แยกเป็น 2 เมนูใน sidebar
   - Sheet handle → closeSheet() onclick
```
Git Restore Points
```
f3adb9c  Superboard Dashboard Live4/4 (safe)
ab5ec4d  PWA shell foundation
c778e1d  PWA Phase 1 complete
890acd6  store.js v1.18 — 7-tab full parity
ac5ad6f  reserve bill system
89bd450  delivery.html ← LATEST
```
Known Issues
```
- delivery.html: card size ใหญ่เกิน ต้องปรับ UI
- Tab4 ตัด/ย้าย: ใช้ PUT /products/update แทน dedicated endpoint
- Tab3 รับสินค้า: pos_receive.py ไม่แยก warehouse
- Tab5 ชุดสินค้า: billing.js ยังไม่รองรับ bundle type
```
---
[F] ROADMAP
```
ตอนนี้ (Phase 2):
  PC Dashboard: delivery.html UI fix
  PWA billing: discount/VAT/doc-type
  pos_line.py: LINE webhook
  PWA members: CRUD

เดือน 1-2:
  Feature Flag (Backend + Frontend)
  AI Quota Tables
  Blue/Green setup

เดือน 2-3:
  moduleai: LiteLLM + Anthropic SDK + Redis
  POS Help Bot (haiku)
  Chat Module AI (sonnet SSE)

เดือน 3-4:
  AutoPost AI (async queue)
  PWA Phase 3

อนาคต:
  Capacitor.js → APK/IPA
  AI Chat Interface
```
---
> **CGO Note:** ไฟล์นี้ = source of truth สำหรับทุก session  
> Claude Code อัปเดต Section [E] ทุกสิ้นวัน  
> Version bump ทุกครั้งที่มี decision หรือ progress ใหม่

[v1.36 ADDITIONS]
billing_statements table: DB + 5 endpoints (list, unpaid-bills, create, record, delete)
statement.html + statement.js: ใบวางบิล list+create+cheque+delete
cheque fields: dropdown ธนาคาร, ผู้สั่ง, ผู้รับ, เลขเช็ค, วันดิว
delivery.html UI patch: #fef9ee, border-left amber, compact card
path fix: frontend/superboard → modules/pos/merchant/ui/dashboard

[v1.36 UPDATE — 2026-04-25]

PATH FIX:
modules/pos/merchant/ui/dashboard/billing/delivery.html ✅
modules/pos/merchant/ui/dashboard/billing/reserve.html ✅
modules/pos/merchant/ui/dashboard/billing/statement.html ✅ NEW
modules/pos/merchant/ui/dashboard/billing/statement.js ✅ NEW

COMPLETED v1.36:
✅ delivery.html UI patch — background #fef9ee, border-left amber, padding 10px 14px, ซ่อนวันที่
✅ DB migration — CREATE TABLE billing_statements (id, run_id, tenant_id, bill_ids, total_amt, discount, vat_amt, vat_type, net_amt, due_dates, due_single, split_pay, status, payment_method, slip_url, cheque_detail, appointment_note, created_by, recorded_by)
✅ pos_statements.py — 5 endpoints: GET /list, GET /unpaid-bills, POST /create, PATCH /record/{id}, DELETE /{id}
✅ registered ใน main.py
✅ statement.html + statement.js — list เรียงใหม่สุดบนสุด, filter ไม่แสดง paid, checkbox แสดงทั้งหมด, ค้นหา run_id/ชื่อ, cheque dropdown ธนาคาร+ผู้สั่ง+ผู้รับ+เลขเช็ค+วันดิว, ปุ่มลบ soft delete
✅ JS แยกไฟล์ statement.js — fix dashboard innerHTML inject SyntaxError

RULES เพิ่ม:
Rule 34 — ก่อนส่ง spec ทุกครั้ง confirm path: ls [path] 2>&1 && echo "PATH OK"
Rule 35 — statement.html ต้องเป็น standalone HTML ห้ามแก้ loadSubPage() ใน dashboard.html
Rule 36 — ระบุชื่อไฟล์เป้าหมายใน prompt ทุกครั้ง ห้าม Claude Code อ่านไฟล์ที่ไม่เกี่ยว
Rule 37 — Pro subscription ห้ามแก้ dashboard loading mechanism เสี่ยง regression ทุกเมนู

DECISIONS เพิ่ม:
20 — billing_statements table ใหม่ แยกจาก bills v1.36
21 — statement.js แยกไฟล์จาก HTML fix dashboard innerHTML inject v1.36
22 — Pro subscription ห้ามแก้ loadSubPage/dashboard mechanism v1.36
23 — model selection per task: haiku=CSS/debug/grep, sonnet=multi-file/feature ใหม่ v1.36

KNOWN ISSUES v1.36:
- statement.js: stRender pattern replace miss ตอน Pro แก้ครั้งสุดท้าย ต้อง verify ก่อน deploy
- cheque dropdown อาจยัง render ไม่ครบ รอ test รอบถัดไป

GIT RESTORE POINTS เพิ่ม:
89bd450  delivery.html UI patch
[pending] statement.html+js complete — commit ยังไม่ได้ทำ



[v1.37 UPDATE — 2026-04-25]

SQL MIGRATION (already run in Supabase):
ALTER TABLE billing_statements
  ADD COLUMN IF NOT EXISTS partial_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS negotiation_note text,
  ADD COLUMN IF NOT EXISTS appointment_dt timestamptz;

COMPLETED v1.37:
✅ TASK 1 — statement.html/js: revert left search → filter statement list by run_id/partner_name/contact_name (client-side)
✅ TASK 2 — statement.html/js: 3-mode button system (delivered/cheque/appointment) + _currentMode + stSetMode() + _buildModeHtml()
✅ TASK 3 — statement.html/js: ชำระบางส่วน modal (stOpenPartial/stConfirmPartial) — validate partial_amount>0 + slip required → POST upload-slip → PATCH record
✅ TASK 4 — statement.html/js: ชำระเงินแล้ว modal (stOpenPaid/stConfirmPaid) — validate slip required → POST upload-slip → PATCH record
✅ TASK 5 — pos_statements.py: POST /upload-slip/{id} (multipart UploadFile → uploads/statements/{tid}/), PATCH /record extended (partial_amount, negotiation_note, appointment_dt, due_single, cheque_detail JSON-safe), GET /list columns extended
✅ TASK 6 — VIIV_MASTER.md v1.37 block appended

FILES CHANGED:
- modules/pos/merchant/ui/dashboard/billing/statement.html (full rewrite — CSS + HTML + embedded JS)
- modules/pos/merchant/ui/dashboard/billing/statement.js (updated, mirrors embedded JS)
- app/api/pos_statements.py (new imports, new endpoint, updated PATCH + GET)

RULES เพิ่ม:
Rule 38 — statement.html IS standalone (loadSubPage injects body+script) — JS must be embedded inline, NOT in separate .js file via <script src>
Rule 39 — upload-slip endpoint ใช้ multipart/form-data, frontend ห้าม set Content-Type header (ให้ browser auto-set boundary)

DECISIONS เพิ่ม:
24 — 3-mode system แทน 2-button: delivered/cheque/appointment รวม negotiation_note ด้วย v1.37
25 — upload flow 2-step: POST upload-slip → PATCH record (แยก slip upload กับ status update) v1.37

Version: v1.37 | Updated: 2026-04-25

---

[v1.38 UPDATE — 2026-04-25]

SQL MIGRATION (รันใน Supabase แล้ว):
  ALTER TABLE billing_statements
  ADD COLUMN IF NOT EXISTS partner_id text,
  ADD COLUMN IF NOT EXISTS partner_name text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS partner_address text,
  ADD COLUMN IF NOT EXISTS partner_tax_id text,
  ADD COLUMN IF NOT EXISTS partner_code text;

COMPLETED v1.38:
✅ TASK 1 — card + search — แสดง partner_name, contact_name, partner_code ใน card + กรองใน search
✅ TASK 2 — form header — st-partner-info block (name/code/tax_id/addr/phone) + snapshot ใน POST /create
✅ TASK 3 — ปุ่มพิมพ์ — stPrint() fetch bank/list + /{sid}/bills → print window HTML template + ลายเซ็น
✅ TASK 4 — action bar — ซ้าย: ประวัติ/ชำระบางส่วน/ชำระแล้ว | ขวา: ลบ(ซ่อน)/ยกเลิก/บันทึก
✅ btn-delete — แสดงเฉพาะ mode=edit, guard status=paid
✅ TASK 5 — VIIV_MASTER.md v1.38

FILES CHANGED:
- modules/pos/merchant/ui/dashboard/billing/statement.html (full rewrite)
- modules/pos/merchant/ui/dashboard/billing/statement.js (sync)
- app/api/pos_statements.py (GET /list JOIN partners, POST /create snapshot, GET /{sid}/bills)

Version: v1.38 | Updated: 2026-04-25

[v1.39 UPDATE — 2026-04-25]

SQL MIGRATION (รันใน Supabase แล้ว):
  ALTER TABLE billing_statements
  RENAME COLUMN partner_id TO member_id;

COMPLETED v1.39:
✅ TASK 1 — สร้างใหม่ต้องเลือกสมาชิกก่อน — selector modal: ค้นหา member → dropdown autocomplete → เลือก → โหลดบิล → เลือกบิล → ยืนยัน
✅ TASK 2 — backend: GET /unpaid-bills?member_id= filter customer_id + NOT EXISTS subquery exclude บิลที่อยู่ใน billing_statements แล้ว; POST /create รับ member_id query members table สร้าง snapshot
✅ TASK 3 — SQL migration: RENAME partner_id → member_id (รันแล้ว)
✅ TASK 4 — VIIV_MASTER.md v1.39

KEY CHANGES:
- stOpenSelector: reset state เท่านั้น ไม่เรียก API
- stSearchMembers: debounce 300ms → /api/pos/members/list?q= → dropdown
- stSelectMember: set _selectedMember → แสดง info → fetch /unpaid-bills?member_id=
- _updateConfirmBtn: enable เมื่อ _selectedMember && _selectedBills.length > 0
- stConfirmBills: ตรวจ _selectedMember ก่อน, แสดง member info block (ไม่ใช่ dropdown)
- stCreate: ส่ง member_id แทน partner_id
- stCancelForm: reset _selectedMember = null

FILES CHANGED:
- app/api/pos_statements.py (GET /list JOIN members, GET /unpaid-bills member_id param + NOT EXISTS, POST /create member snapshot)
- modules/pos/merchant/ui/dashboard/billing/statement.html (full rewrite — member-first create flow)
- modules/pos/merchant/ui/dashboard/billing/statement.js (sync กับ statement.html)

Version: v1.39 | Updated: 2026-04-25

# VIIV PRINCIPLES — Architecture Laws & Workflow Update
> เพิ่มต่อท้าย VIIV_MASTER.md
> Updated: 2026-04-25

---

## [G] ARCHITECTURE LAWS (ห้ามละเมิด)

### Law 1 — Single Source of Truth: SALES
```
bills table = ยอดขายทั้งระบบ (จุดเดียว)

ครอบคลุมทุกเอกสาร:
  invoice, receipt, reserve, delivery, creditnote, statement

กฎ:
  - ยอดขายเกิดได้จาก bills เท่านั้น
  - table อื่นเก็บได้แค่ bill_id (reference) + metadata เฉพาะของตัวเอง
  - ห้าม duplicate: ยอดเงิน, ข้อมูลลูกค้า, รายการสินค้า
  - display / print / report ทุกอย่างดึงจาก bills เสมอ
  - ละเมิด = ความเสียหายต่อระบบบัญชีทั้งหมด
```

### Law 2 — Single Source of Truth: MONEY
```
บัญชี/การเงิน = เงินจริง (money flow) เท่านั้น

กฎ:
  - รับ bill_id มาอ้างอิงเท่านั้น ไม่ duplicate ยอด
  - ยอดในบัญชี = เงินจริง ไม่ใช่ยอดขาย
  - ยอดขาย + ใบลดหนี้ + รายจ่ายอื่น → รวมเป็นยอดบัญชี
  - bills และบัญชีต้องแยกกันเสมอ
```

### Law 3 — Single Source of Truth: CUSTOMER
```
members table (pos) = ลูกค้าทั้งระบบ (จุดเดียว)
pos เป็นเจ้าภาพ members ทั้งระบบ

ช่องทางสร้าง member (3 ทาง):
  1. LINE/Chat → AI สร้างอัตโนมัติเมื่อลูกค้าติดต่อเข้ามา
  2. Admin/Staff สร้างเอง
  3. Comment/Social → Chat ดูดเข้า members

กฎ:
  - ทุก module reference member_id เท่านั้น
  - ห้าม module อื่นสร้าง customer table ของตัวเอง
  - ลูกค้าคนเดียว = member record เดียวทั้งระบบ
  - pos, chat, autopost, affiliate ใช้ member_id เดียวกัน
```

### Law 4 — Table Design Rule
```
ก่อนสร้าง column ใหม่ ต้องตอบได้ว่า:
  "ข้อมูลนี้มีอยู่ใน bills หรือ members แล้วหรือเปล่า?"
  ถ้าตอบว่า "มีแล้ว" → ห้ามสร้าง ให้ reference แทน
  ถ้าตอบว่า "ไม่มี" → สร้างได้ แต่ต้องเป็น metadata เฉพาะ

ตัวอย่างที่ถูกต้อง:
  billing_statements เก็บ:
    ✅ bill_ids[]       → reference เท่านั้น
    ✅ due_single       → metadata เฉพาะ (วันนัดชำระ)
    ✅ negotiation_note → metadata เฉพาะ (บันทึกเจรจา)
    ✅ run_id           → ID สำหรับเรียกดู
    ❌ customer_name    → มีใน bills แล้ว
    ❌ total_amt        → มีใน bills แล้ว (ห้าม duplicate)
```

---

## [H] WORKFLOW UPDATE (v1.41)

### Execution Model (v1.42)
```
CGO Chat    = Claude Pro (แยกบัญชี) — architecture, decisions, MASTER.md
CTO Chat    = Claude Pro (same account as Claude Code) — review, spec, สั่ง Claude Code
Claude Code = Pro subscription (same as CTO) — implement ทั้งหมด
             ⚠️ CTO + Claude Code = บัญชีเดียวกัน → limit นับรวม
Terminal    = รับ pyeof จาก CGO โดยตรง — debug, grep, short scripts
API Key     = debug only — ห้ามเขียนโค้ดใหม่

เหตุผล:
  - Pro = ไม่มีค่า token ต่อครั้ง → ใช้เขียนโค้ดทั้งหมด
  - API = แพงมาก ($0.6/นาที sonnet) → debug only
```

### Pro Subscription Management
```
มี 3 บัญชี Pro หมุนเวียน (CGO แยกบัญชี + CTO/Claude Code ใช้บัญชีเดียวกัน)

⚠️ สลับบัญชีที่ 80% limit (Rule 46) — ไม่รอจนเต็ม
เหตุผล: ถ้าเต็มแล้วสลับ = ติด block ทั้งหมด ต้องลบลงใหม่

CGO ต้องแจ้งผมเมื่อ:
  - prompt ที่จะส่งมีขนาดใหญ่ (> 500 บรรทัด code)
  - task นี้คาดว่าจะใช้ token เยอะ (multi-file rewrite)
  → แจ้งก่อนส่ง เพื่อประเมินว่าต้องสลับบัญชีไหม

วิธีเช็ค limit: ดูจาก Claude Code UI หรือถามผม
```

### CGO Prompt Rules (เพิ่มเติม)
```
Rule 40 — Single Source of Truth (ห้ามละเมิด)
  bills = ยอดขาย | members = ลูกค้า | บัญชี = เงินจริง
  ห้าม duplicate ข้อมูลข้าม table

Rule 41 — Customer Single Source
  members table คือลูกค้าทั้งระบบ
  ห้าม module อื่นสร้าง customer/member table ของตัวเอง

Rule 42 — Table Column Validation
  ก่อนสร้าง column ใหม่ → ถามว่ามีใน bills/members แล้วหรือยัง
  ถ้ามีแล้ว → ใช้ reference (id) แทน

Rule 43 — API Usage Policy
  API = debug only (หลัง implement เสร็จ)
  Pro subscription = เขียนโค้ด, implement, rewrite
  ห้ามใช้ API เขียนโค้ดใหม่หรือ rewrite ไฟล์ใหญ่

Rule 44 — Pro Limit Warning
  CGO แจ้งผมที่ 90% limit ก่อนส่ง task ใหญ่
  มี 3 บัญชี Pro หมุนเวียน
  สลับที่ 90% ไม่ใช่รอให้เต็ม
```

---

## [I] LESSONS LEARNED (2026-04-25)

```
❌ สิ่งที่ผิดพลาดวันนี้:
  - สร้าง columns ซ้ำใน billing_statements (partner_name, contact_name ฯลฯ)
  - ไม่ฟัง CGO ที่บอกว่า "ข้อมูลมีอยู่แล้ว"
  - rewrite ทั้งไฟล์ทุกรอบแทนที่จะเพิ่ม function
  - ใช้ API เขียนโค้ดใหญ่ → เสีย $17 + เสียเวลาทั้งวัน
  - concept ไม่นิ่งก่อน implement

✅ วิธีที่ถูกต้อง:
  - Lock concept ก่อนเสมอ (CGO approve แล้วค่อยเขียน)
  - ถาม "มีใน bills/members แล้วไหม?" ก่อนสร้างอะไรใหม่
  - เพิ่ม function ไม่ใช่ rewrite
  - Pro สำหรับเขียนโค้ด API สำหรับ debug
  - สลับ Pro ที่ 90% limit
```

---

> Version: v1.41 | Updated: 2026-04-25
> "ยอดขายมีจุดเดียว เงินมีจุดเดียว ลูกค้ามีจุดเดียว"

---

## [E] PROGRESS LOG

### [v1.41 UPDATE — 2026-04-25]

COMPLETED v1.41:
✅ card — customer_name/customer_code จาก bills โดยตรง (ลบ partner_name/contact_name)
✅ create modal — ค้นหาบิลโดยตรง ไม่ผ่าน member (stSearchBillsDirect, debounce 400ms)
✅ unpaid-bills query — require q, LIMIT 20, ลบ customer_data (Rule 40)
✅ lock customer_id — บิลต่าง customer ถูก disabled อัตโนมัติ
✅ print A4 — Sarabun Google Fonts, store/info+bank/list+bills parallel fetch
✅ print customer — ดึงจาก bills[0] โดยตรง (ไม่ duplicate จาก statement)
✅ paid cascade → bills status='paid' (มีอยู่แล้วใน record endpoint)
✅ void/ลบ cascade → bills status='pending' (มีอยู่แล้วใน delete endpoint)
✅ action bar — ปุ่มลบซ่อนเมื่อ status='paid'

Files changed:
  app/api/pos_statements.py
  modules/pos/merchant/ui/dashboard/billing/statement.js
  modules/pos/merchant/ui/dashboard/billing/statement.html

---

### [v1.42 UPDATE — 2026-04-25]

EXECUTION MODEL CHANGE:
  CTO Chat    = Claude Pro (same account as Claude Code) — review, spec, สั่ง implement
  Claude Code = Pro subscription (same as CTO) ⚠️ limit นับรวม → แจ้ง CGO ที่ 80%
  CGO Chat    = Claude Pro (แยกบัญชี) — architecture, decisions, MASTER.md
  Terminal    = debug, grep, pyeof เท่านั้น
  API Key     = debug only ห้ามเขียนโค้ดใหม่

STATEMENT.HTML STATUS (สถานะจริงวันนี้):
  ✅ list + search + card (customer_name/customer_code จาก bills โดยตรง)
  ✅ create modal (ค้นหาบิลโดยตรง, lock customer_id หลังเลือกบิลแรก)
  ✅ cheque fields + 3-mode payment (delivered/cheque/appointment)
  ✅ partial/paid modal + upload slip
  ✅ print A4 (Sarabun, store/settings + bank/list + bills parallel fetch)
  ✅ action bar: ปุ่มลบซ่อนเมื่อ status=paid
  ✅ create.html search dropdown bug fixed (polling window.VIIV_TOKEN)
  ⚠️ รายละเอียดลูกค้าใน right panel ยังไม่ครบ (ที่อยู่, tax_id, เบอร์)
     → ต้อง JOIN members realtime ตอน stOpen() display (ห้าม duplicate ใน table)

COMPLETED v1.42:
✅ VIIV_MASTER.md — ปรับ Execution Model v1.42 (CTO+Claude Code = same account)
✅ VIIV_MASTER.md — เพิ่ม Rule 45, 46, 47
✅ VIIV_MASTER.md — ลบ Next Up ซ้ำใน v1.36-v1.39 blocks
✅ VIIV_MASTER.md — อัปเดต Next Up priority ตามสถานะจริง

RULES เพิ่ม:
Rule 45 — CGO ห้าม debug ทีละบรรทัดเอง → วิเคราะห์ root cause ส่ง spec ให้ Claude Code
Rule 46 — CTO + Claude Code ใช้ Pro บัญชีเดียวกัน → แจ้ง CGO ที่ 80% limit
Rule 47 — billing/create.html: init ด้วย polling window.VIIV_TOKEN แทน _tok_ pattern

Version: v1.42 | Updated: 2026-04-25
