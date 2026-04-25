# VIIV MASTER — CGO Reference
> **copy ไฟล์นี้ทั้งหมดเพื่อเปิดแชทใหม่กับ CGO ทุกครั้ง**  
> Version: v1.36 | Updated: 2026-04-25  
> Claude Code อัปเดต Section [E] ทุกสิ้นวัน
---
[A] ROLE & WORKFLOW
บทบาท
```
CGO (subscription1)  = Claude.ai Pro — ผู้กำหนดทิศทาง, architecture, spec, token budget
CTO (subscription2)  = Claude.ai Pro — review, validate, second opinion (ถามได้อิสระ)
Execute              = Claude Code (API) — executor เขียนโค้ดตาม spec ที่ CGO กำหนด
เจ้าของโปรเจกต์      = ส่ง spec ให้ CGO → CGO แปลงเป็น task → Claude Code implement
```
Daily Workflow
```
เช้า:     copy VIIV_MASTER.md ทั้งไฟล์ → เปิดแชทใหม่ → CGO เก็ต context 100%
ระหว่างวัน: CGO ออก spec → Claude Code implement → test
เย็น:     CGO สั่ง Claude Code: "สรุปวันนี้ เพิ่มใน VIIV_MASTER.md Section [E]"
พรุ่งนี้: copy ไฟล์ใหม่ → เปิดแชท → ทำต่อ
```
Execution Workflow (v1.34)
```
→ API      = งานสแกนไฟล์, แก้บัค, rewrite (Claude Code API key)
→ PRO      = งานเขียนโค้ดยาว, python EOF (Claude Pro อีกบัญชี)
→ TERMINAL = รันคำสั่งสั้นได้เลย (bash, psql, grep)
CGO chat ไม่เขียนโค้ดยาว — เขียนแต่ prompt และ spec เท่านั้น
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
Next Up (ลำดับ Priority)
```
1. 🔴 HIGH  — delivery.html: ลด card size + ปรับสีพื้น/UI ให้แยกจากหน้ารวมบิล
2. 🔴 HIGH  — PWA billing: เพิ่ม discount, VAT, doc type (invoice/receipt)
3. 🔴 HIGH  — pos_line.py: LINE Webhook + pending-uid
4. 🟡 MED   — PWA members: add/edit member form
5. 🟡 MED   — Dashboard API: ยอดแชท, Affiliate, AutoPost (real data)
6. 🟡 MED   — PWA Phase 2: easysale, affiliate, finance
7. 🟡 MED   — Feature Flag Schema + AI Quota Tables (DB)
8. 🟡 MED   — Blue-Green setup: สร้าง viiv-green + scripts
9. 🔵 FUT   — PWA Phase 3: receive, settings
10. 🔵 FUT  — Capacitor.js → APK/IPA
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

NEXT UP (ปรับ priority):
1. 🔴 HIGH — statement.html: verify cheque fields + stRender fix
2. 🔴 HIGH — PWA billing: discount, VAT, doc type
3. 🔴 HIGH — pos_line.py: LINE Webhook + pending-uid
4. 🟡 MED — PWA members: add/edit form
5. 🟡 MED — Feature Flag Schema + AI Quota Tables

GIT RESTORE POINTS เพิ่ม:
89bd450  delivery.html UI patch
[pending] statement.html+js complete — commit ยังไม่ได้ทำ

Version: v1.36 | Updated: 2026-04-25

Model Policy
claude-haiku-4-5   → งานทั่วไป (edit, debug, CSS, < 100 บรรทัด)
claude-sonnet-4-6  → complex logic, multi-file, architecture
claude-opus        → ห้ามใช้ยกเว้น CGO อนุมัติ
❌ FORBIDDEN: claude-sonnet-4-7, claude-haiku-4-6 หรือ version อื่น