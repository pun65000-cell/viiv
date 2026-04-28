# VIIV MASTER — Project Reference
> **copy ไฟล์นี้ทั้งหมดเพื่อเปิดแชทใหม่ทุกครั้ง**  
> Version: v1.51 | Updated: 2026-04-28  
> Claude Code อัปเดต Section [E] ทุกสิ้นวัน
---
[A] ROLE & WORKFLOW
บทบาท (v1.45)
```
AI แชท     = claude.ai (Pro) — ช่วยวิเคราะห์, ออกแบบ, เขียนโค้ด
             ✅ ส่งโค้ดพร้อม copy-paste ไปวางที่ Terminal ได้เลย
             ✅ ถ้าเป็นคำสั่งสั้น → ส่งเป็น bash block พร้อมรัน
             ✅ ถ้าเป็นโค้ดยาว → ส่งแบบแยก file พร้อม path ชัดเจน

Claude Code = ใน Terminal — รับคำสั่งภาษาไทยโดยตรงจากเจ้าของโปรเจกต์
             ✅ implement ตามที่สั่ง โดยไม่ต้องแปลง spec ก่อน
             ✅ อ่าน CLAUDE.md อัตโนมัติทุก session
             ✅ อัปเดต VIIV_MASTER.md Section [E] เมื่อสิ้นวัน

Terminal    = รันคำสั่ง bash, debug, grep, short scripts
API Key     = debug only — ห้ามเขียนโค้ดใหม่
```
Daily Workflow
```
เช้า:         copy VIIV_MASTER.md → วางใน AI แชท → ได้ context 100%
ระหว่างวัน:   สั่ง Claude Code ภาษาไทยโดยตรง → implement → test
              หรือ ถาม AI แชท → ได้โค้ด copy-paste → วางที่ Terminal
เย็น:         สั่ง Claude Code: "สรุปวันนี้ เพิ่มใน VIIV_MASTER.md Section [E]"
พรุ่งนี้:     copy ไฟล์ใหม่ → เปิดแชท → ทำต่อ
```
Execution Workflow (v1.45)
```
→ Claude Code    = งานเขียนโค้ด implement, rewrite, feature ทุกอย่าง
                   รับคำสั่งภาษาไทยจากเจ้าของโปรเจกต์โดยตรง
→ AI แชท         = ถาม architecture, ดีไซน์, ขอโค้ดตัวอย่าง copy-paste
→ Terminal (!)   = รัน bash command จาก AI แชท — พิมพ์ ! นำหน้าคำสั่ง
→ API Key        = debug only หลัง implement เสร็จ
```
Model Policy
```
claude-haiku-4-5   → งานทั่วไป (edit, debug, < 100 บรรทัด)
claude-sonnet-4-6  → complex logic, multi-file, architecture
claude-opus        → ห้ามใช้ยกเว้นอนุมัติเป็นลายลักษณ์อักษร
```
Token Rules
```
Claude Code อ่านเฉพาะไฟล์ที่เกี่ยวกับ task นั้น
ถ้า task ต้อง read > 3 ไฟล์ → แจ้งก่อน แบ่ง task
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

---

### [v1.43 PLAN — 2026-04-26] API-First Refactor

GOAL: Backend owns all business rules → UI เป็น thin shell → Mobile/AI-chat ใช้ API เดียวกันได้

STEP 1 — pos_bills.py: Backend owns cascade [✅ done]
STEP 2 — create.html: ลบ statusMap ออกจาก JS [✅ done]
STEP 3 — create.html: fix bugs (clearBillSilent, free-text customer, reloadMembers) [✅ done]
STEP 4 — commit [✅ done — 623c537]

Rule 48 — create.html: ห้าม statusMap/shippingMap ใน JS → backend เป็น single source of truth (PAY_MAP ใน pos_bills.py)
Rule 49 — bills ห้าม hard DELETE → ใช้ UPDATE status='deleted' เสมอ (soft delete)
           เหตุผล: billing_statements อ้างอิง bill_ids → ถ้า hard delete bills, statements สูญ customer data
Rule 50 — Single Source of Truth:
           bills        = truth ของธุรกรรม + customer snapshot (customer_data JSON)
           members      = truth ของ master customer data
           billing_statements = เก็บเฉพาะ run_id, bill_ids[], status, slip_url, cheque/appt fields
           ห้ามเก็บ customer_name/code/phone ซ้ำใน billing_statements → ดึงจาก bills.customer_data เสมอ

### [v1.43 COMPLETED — 2026-04-26]
✅ API-first refactor: PAY_MAP ใน pos_bills.py (backend owns cascade)
✅ create.html: ลบ statusMap/finShipMap ออก, UI เป็น thin shell
✅ create.html: fix clearBillSilent (onPayMethodChange bare call)
✅ create.html: customer free-text ได้ (ไม่บังคับ dropdown)
✅ create.html: ลบ reloadMembers() ทุก keystroke
✅ statement.html: card แสดง phone
✅ search.html: popup กว้าง 680px
✅ DB cleanup: ลบ 35 test bills (created_by=unknown)
✅ Rule 48 เพิ่ม

Version: v1.43 | Updated: 2026-04-26

---

### [v1.44 COMPLETED — 2026-04-26] Statement Indicator Fix + Architecture Cleanup

GOAL: statement indicator ใน ship popup แสดงสีน้ำตาลถูกต้อง + single source of truth

FIXES:
✅ search.html: `by-bill` fetch ใช้ `b.db_id` แทน `b.id`
   — `b.id` = bill_no (BILL-2026-000033), `b.db_id` = UUID จริง (bill_1777201470_zrpf)
   — billing_statements.bill_ids เก็บ UUID → fetch ก่อนหน้า query ไม่ match เลย
   — บรรทัด 627: `b.id` → `(b.db_id||b.id)`

✅ pos_statements.py: `/unpaid-bills` ลบ guard `if not q: return []`
   — ตอนนี้ return bills ทุกใบถ้า q ว่าง (LIMIT 50)
   — statement.html popup แสดง unpaid bills ทันทีเมื่อเปิด

✅ pos_statements.py: `/list` ดึง customer_name/phone/address จาก bills.customer_data JSON
   — ไม่ JOIN members table ซ้ำ (single source of truth)

✅ Rule 49 + 50 เพิ่ม: bills soft-delete only, billing_statements ไม่เก็บ customer fields ซ้ำ

✅ DB cleanup: ลบ orphaned statements (BS-ten_1-20260426-001, 002) ที่ bill_ids ชี้ไป deleted bills

RULES เพิ่ม:
Rule 49 — bills ห้าม hard DELETE → soft delete (UPDATE status='deleted') เสมอ
Rule 50 — billing_statements ไม่เก็บ customer fields ซ้ำ → อ่านจาก bills.customer_data เสมอ

Version: v1.44 | Updated: 2026-04-26

## [E] PROGRESS LOG

### [v1.45 UPDATE — 2026-04-26]

COMPLETED v1.45:

✅ members.js — form responsive (auto-fill minmax) ทั้ง store และ partner form
✅ members.js — tab คู่ค้า restore หลัง reload (hash ?tab=partner)
✅ router.js — parse hash query string สำหรับ tab params
✅ sw.js v6 — network-first JS + bump.sh script (~/viiv/bump.sh)
✅ sales.js — ยอดขาย PWA page (Router.go แทน window.open, ไม่หลุดออกนอก PWA)
✅ pos.js — MENUS ใหม่ 9 เมนู (Affiliate/สมาชิก/คำสั่งซื้อ/บิลใบเสร็จ/สโตร์/Status/รับสินค้า/บัญชี/เพิ่มเติม)
✅ pos.js — _openMoreSheet ใหม่ (จองสินค้า/ร้านค้า/ตั้งค่าบิล/ธนาคาร/เชื่อมLINE/รออนุมัติ + เมนูเดิม)
✅ pos.js — _openStatusSheet (ยอดขายวันนี้/เดือนนี้/จัดส่ง/การเงิน)
✅ index.html — AI boost button (SVG sparkle animate) + Bell notification
✅ index.html — ViiV Platform label บน topbar
✅ app.js — Bell.toggle/markAll/showDot
✅ bill.js — หน้าบิลใบเสร็จ PWA (#bill) ค้นหา+filter+รายละเอียด+พิมพ์+แชร์
✅ pos_bills.py — _snapshot_member() JOIN members ตอนสร้างบิล (address/tax_id/phone/email ครบ)
✅ router.js — alias bill→pos ยกเลิก, bill register แยกหน้าแล้ว

FILES CHANGED:
  frontend/pwa/pages/members.js
  frontend/pwa/pages/sales.js (NEW)
  frontend/pwa/pages/bill.js (NEW)
  frontend/pwa/pages/pos.js
  frontend/pwa/js/router.js
  frontend/pwa/js/app.js
  frontend/pwa/js/auth.js
  frontend/pwa/index.html
  frontend/pwa/css/app.css
  frontend/pwa/sw.js
  app/api/pos_bills.py

RULES เพิ่ม:
Rule 48 — bill_no ต้องมาจาก gen_bill_no() เสมอ ห้าม client ส่งมาตรงๆ
Rule 49 — DRAFT- prefix = ยังไม่ finalize ห้าม expose ลูกค้า
Rule 50 — customer_data snapshot ต้อง JOIN members ที่ backend เสมอ ห้าม frontend ส่งแค่บางฟิลด์
Rule 51 — PWA page ใหม่ทุกหน้าต้อง Router.register + เพิ่มใน index.html + bump.sh
Rule 52 — browser autofill กัน: ใช้ setTimeout clear ใน _bindFilters (300ms)
Rule 53 — SW JS network-first: แก้ JS ไฟล์ไหนก็ได้ รัน ~/viiv/bump.sh รอบเดียวจบ

DECISIONS เพิ่ม:
26 — bill_no standard: BILL-YYYY-XXXXXX เท่านั้น (server gen_bill_no())
27 — PWA flat navigation: list → bottom sheet (ไม่มี nested page)
28 — customer_data = full snapshot จาก members ตอนสร้างบิล (backend owns)

---
[2026-04-27 v1.45] Mobile คำสั่งซื้อ (#orders) — ปรับให้ตรงกับ PC version

✅ orders.js — เปลี่ยน title 'ออเดอร์' → 'คำสั่งซื้อ'
✅ orders.js — เพิ่ม filter bar: status dropdown (8 สถานะ) + doc_type + shipping_status (12 สถานะ)
✅ orders.js — _listRow ใหม่: แสดง doc_type badge, วิธีชำระ, วันที่, จำนวนรายการ, POS badge
✅ orders.js — โหลด 500 รายการ client-side filter (shipping_status filter ไม่มีใน API)
✅ orders-detail.js — FIN_STATUS ครบ 8 สถานะ (paid/transfer_paid/paid_waiting/transfer_waiting/partial/credit/pending/voided)
✅ orders-detail.js — SHIP_STATUS ครบ 11 สถานะ (รวม paid_waiting/deposit_waiting/debt_collection/debt-NPL)
✅ orders-detail.js — _shipExtraHtml ใหม่: field bank dropdown + camera button + report textarea + due date
✅ orders-detail.js — กลับปุ่ม '← คำสั่งซื้อ' + ปุ่มพิมพ์ + แชร์ + activity log แสดงรูปภาพ
✅ orders-detail.js — _viewPhoto() global popup viewer
✅ index.html — bump v1843 สำหรับ orders.js + orders-detail.js

FILES CHANGED:
  frontend/pwa/pages/orders.js
  frontend/pwa/pages/orders-detail.js
  frontend/pwa/index.html
  VIIV_MASTER.md

Version: v1.45 | Updated: 2026-04-26

COMPLETED v1.46:
✅ receive.js (NEW) — หน้ารับสินค้า PWA v5
   - list ประวัติรับสินค้าล่าสุด + search bar
   - ปุ่ม "+ รับสินค้า" + ปุ่ม "ประวัติ" same row
   - ฟอร์มบันทึก: คู่ค้า, หมายเหตุ, รายการสินค้า (datalist inline), รูปบิล
   - History sheet: ค้นหา supplier/หมายเหตุ/ผู้บันทึก
   - Detail sheet: รายละเอียดครบ + รูปบิล
   - บันทึกข้อมูลเดียวกับ PC version (pos_receive.py)

✅ Router.register('receive') — ลงทะเบียน route ถูกต้อง
✅ index.html — เพิ่ม script tag receive.js
✅ index.html — ลบ tb-ai-btn (ปุ่ม "เพิ่มยอดขาย" เก่า) ออก
✅ index.html — closeDD() null guard (ป้องกัน TypeError)
✅ router.js — ลบ aibtn toggle ออก
✅ bump.sh — รัน bump รวม
FILES CHANGED:
frontend/pwa/pages/receive.js  (NEW)
frontend/pwa/js/router.js
frontend/pwa/index.html
RULES เพิ่ม:
Rule 54 — PWA page ห้ามสร้าง header ซ้อน topbar
           ใช้พื้นที่ #page-container เท่านั้น
Rule 55 — Python heredoc ที่มี emoji/unicode ซับซ้อน
           ให้เขียนไฟล์ .py แล้วรัน python3 /tmp/xxx.py
           ห้ามใช้ inline python3 << 'PYEOF' กับโค้ดยาว
Rule 56 — ก่อนลบ element ใน index.html ต้องลบ
           reference ใน router.js และ js อื่นด้วย
DECISIONS เพิ่ม:
29 — receive.js ใช้ datalist inline แทน picker sheet
     เหมือน PC version products.js (rcSetProduct pattern)
30 — PWA page layout: ห้ามแตะ topbar/navbar
     ทำเฉพาะใน #page-container เท่านั้น
Version: v1.46 | Updated: 2026-04-27

[2026-04-27 v1.47] Mobile Status Sheet — จัดการสถานะครบใน POS เมนู

✅ pos.js — _openStatusSheet() ใหม่: bottom sheet ค้นหาบิล → จัดการสถานะ
✅ pos.js — _ST_FIN (8 สถานะการเงิน) + _ST_SHIP (11 สถานะจัดส่ง) ครบ
✅ pos.js — StatusSheet.search() ค้นหา server-side (/api/pos/bills/list?q=) debounce 400ms
✅ pos.js — StatusSheet.selectBill() → โหลด bill detail → render status grid
✅ pos.js — StatusSheet.setFin() → POST update-status + reload sheet
✅ pos.js — StatusSheet.selectShip() → update button styles + render extra fields
✅ pos.js — StatusSheet.saveShip() → upload photo (OrdersUpload.slip) + POST + reload
✅ pos.js — _stShipExtraHtml() ครบทุก shipping status (scheduled/photo/bank/check/report/due date)
✅ pos.js — _deviceName() detect iPhone/iPad/Android จาก userAgent
✅ pos.js — device identity ใน by field: "📱 ชื่อ · iPhone" ใน activity log
✅ pos.js — activity log แสดงเป็น list (timestamp/status/shipping/note/by/photo)
✅ pos_bills.py — update-status รับ device field → log_entry["by"] = device or uid
✅ index.html — bump pos.js v5280

FILES CHANGED:
  frontend/pwa/pages/pos.js
  frontend/pwa/index.html
  app/api/pos_bills.py
  VIIV_MASTER.md

  COMPLETED v1.47:
✅ pos_finance.py (NEW) — backend บัญชีการเงิน 8 endpoints:

GET /api/pos/finance/summary?month=MM-YYYY (ยอดขายจาก bills + รายรับ/จ่าย + กราฟรายวัน + วันนี้)
GET /api/pos/finance/income?q=&limit=100
GET /api/pos/finance/expense?q=&limit=100
POST /api/pos/finance/income
POST /api/pos/finance/expense
DELETE /api/pos/finance/income/{fid}
DELETE /api/pos/finance/expense/{fid}
POST /api/pos/finance/upload-slip/{entry_type}/{fid}

✅ DB tables สร้างอัตโนมัติตอน import:

finance_income (id text PK, tenant_id, source, pay_type, amount numeric(12,2), slip_url, noted_by, txn_at, created_at)
finance_expense (id text PK, tenant_id, partner_id, source, pay_type, amount numeric(12,2), slip_url, noted_by, txn_at, created_at)
gen_id pattern: fin_inc_/fin_exp_ + timestamp + 4 random chars

✅ finance.js (NEW) — PWA mobile บัญชีการเงิน 532 บรรทัด

Router.register('finance') pattern เหมือน members.js
3 tabs: ภาพรวม (summary cards + Chart.js bar) / รายรับ / รายจ่าย
bottom sheet form เพิ่มรายรับ/รายจ่าย + upload slip

✅ pos.js — เปลี่ยน Router.go('sales') → Router.go('finance') (เมนูบัญชี)
✅ index.html — เพิ่ม script finance.js ก่อน receive.js
✅ bill.js — แก้ bug: data.bills || data || [] (เคยได้ array ว่างเพราะ Array.isArray(data) = false)
✅ orders.js — เพิ่ม gold glow border-left การ์ด: border-left:3px solid var(--gold);box-shadow:-3px 0 8px rgba(232,185,62,0.25)
✅ app/main.py — register pos_finance.router ต่อจาก pos_statements

BUGS FIXED:

partners table ใช้ company_name ไม่ใช่ name → แก้ใน pos_finance.py expense query
bill.js แสดง list ว่าง → data.bills ไม่ใช่ data โดยตรง
orders.js autofill admin@viiv.me ค้าง → เพิ่ม readonly + onfocus removeAttribute (🚧 ยังแก้ไม่เสร็จ รอ limit reset)


KNOWN ISSUES v1.47:

orders.js autofill bug ยังไม่ resolved — ต้องให้ Claude Code แก้ line 190+193 รวม onfocus 2 อันเป็นอันเดียว
finance.js ยังไม่ได้ test ครบทุก tab


RULES เพิ่ม:

Rule 57 — partners table ใช้ company_name ไม่ใช่ name (contact_name, bank_account_name)
Rule 58 — bills API return {bills: [...]} ไม่ใช่ array โดยตรง ต้อง data.bills

Version: v1.47 | Updated: 2026-04-27

---

### [v1.48 COMPLETED — 2026-04-27] Bill Deletion System

GOAL: ระบบลบบิลสำหรับ Admin เท่านั้น — เก็บข้อมูลตลอด, ดูประวัติได้

BACKEND (pos_bills.py):
✅ _get_role_from_token() — helper decode JWT ดึง role field
✅ POST /api/pos/bills/delete/{bid} — Admin-only
   - ตรวจ role: admin/shop_admin/owner เท่านั้น (403 ถ้าไม่ใช่)
   - delete_type: "bill_only" (สต็อกไม่เปลี่ยน) หรือ "with_stock" (คืนสต็อก + stock_log)
   - บันทึกใน bill_void_log: void_type="delete_bill_only"|"delete_with_stock"
   - void_reason format: "[name|device] reason" (เก็บผู้ลบครบ)
   - UPDATE bills SET status='deleted', voided_by=uid, voided_at=NOW()
✅ GET /api/pos/bills/deleted — Admin-only
   - list bills WHERE status='deleted' ORDER BY voided_at DESC LIMIT 200
   - subquery ดึง void_type จาก bill_void_log (delete_ prefix เท่านั้น)

FRONTEND (orders-detail.js):
✅ isAdmin check: ['admin','shop_admin','owner'].includes(App.user?.role)
✅ Admin bar ใต้ topbar (isAdmin only): ปุ่ม "📋 ประวัติบิล" + ปุ่ม "🗑 ลบบิล"
   - ลบบิล ซ่อน ถ้า status=deleted/voided แล้ว
✅ deletePrompt(id, billNo) — Step 1: เลือก ลบบิลอย่างเดียว / ลบ+คืนสต็อก / ยกเลิก
✅ _deleteStep2(id, billNo, deleteType) — Step 2: textarea reason + ยืนยัน + ← กลับ
✅ _executeDelete(id, deleteType) — POST /delete + detect device (iPhone/iPad/Android/Desktop)
   - ส่ง deleted_by_name (App.user?.name/email/id) + deleted_device

FRONTEND (bill-history.js NEW):
✅ Router.register('bill-history') — หน้าประวัติบิลที่ถูกลบ
✅ list deleted bills การ์ด: typeLabel (ลบบิล/ลบ+คืนสต็อก), ผู้ลบ, เหตุผล, วันที่, ยอด, รายการสินค้า (5 แรก)
✅ parse void_reason format "[name|device] reason" → แสดง deleterInfo + cleanReason แยกกัน

index.html:
✅ เพิ่ม bill-history.js?v=8775
✅ bump orders-detail.js v8774 → v8775
✅ fix finance.js path: pages/finance.js → /pwa/pages/finance.js?v=8775

SAFETY (ไม่กระทบระบบเดิม):
- ไม่แตะ void endpoint เดิม (POST /void/{bid}) — ยังทำงานปกติ
- ไม่แตะ bill list query — WHERE status != 'deleted' กรอง soft-deleted ออกอัตโนมัติ
- ไม่เปลี่ยน schema DB — bill_void_log ใช้ column เดิม (void_type, void_reason, voided_by)
- stock_log action="delete_return" (ต่างจาก void_return เดิม)

FILES CHANGED:
  app/api/pos_bills.py (+_get_role_from_token, +delete_bill, +list_deleted)
  frontend/pwa/pages/orders-detail.js (+isAdmin, +admin bar, +deletePrompt/_deleteStep2/_executeDelete)
  frontend/pwa/pages/bill-history.js (NEW)
  frontend/pwa/index.html (+bill-history.js, bump v8775, fix finance.js path)
  VIIV_MASTER.md

Version: v1.48 | Updated: 2026-04-27

### [v1.49 COMPLETED — 2026-04-27] Bill Deletion Fixes + bill-history Router Fix

COMPLETED v1.49:
✅ app/api/pos_bills.py — _get_role_from_token() helper (JWT decode สำหรับ admin gate)
✅ app/api/pos_bills.py — POST /delete/{bid}: soft delete + stock return option + bill_void_log
✅ app/api/pos_bills.py — GET /deleted: admin-only ประวัติบิลถูกลบ
✅ frontend/pwa/js/auth.js — DEV_TOKEN ใหม่มี role/sub/name (เดิมไม่มี role → ปุ่มแอดมินไม่ขึ้น)
✅ frontend/pwa/js/auth.js — Auth.init() upgrade: token เก่าไม่มี role → fall through ใช้ DEV_TOKEN ใหม่
✅ frontend/pwa/js/app.js — เพิ่ม _parseJwt() + App.user getter (id/role/name จาก JWT)
✅ frontend/pwa/pages/bill.js — ปุ่ม 📋ประวัติบิล (admin, filter bar) + 🗑ลบบิล (admin, detail sheet)
✅ frontend/pwa/pages/bill.js — deletePrompt/_deleteStep2/_execDelete (2-step confirm)
✅ frontend/pwa/pages/bill.js — ลบ voidPrompt/confirmVoid ออก ("ยกเลิก"=ปิด sheet ไม่ใช่ void)
✅ frontend/pwa/pages/orders-detail.js — admin bar + ปุ่มลบบิล + 3 delete functions
✅ frontend/pwa/pages/bill-history.js (NEW) — แก้ bug: register ด้วย {render,mount} แทน {load} → Router crash
✅ frontend/pwa/index.html — +bill-history.js script tag, bump v=2521

KEY FIXES:
- Router register interface: ต้องใช้ { title, load, destroy } ไม่ใช่ { render, mount, destroy }
- DEV_TOKEN เก่า payload: {"tenant_id","user_id"} → ใหม่: {"sub","tenant_id","role","admin","name"}
- Rule 49 เพิ่ม: bills ใช้ soft delete เท่านั้น (UPDATE status='deleted')

FILES CHANGED:
  app/api/pos_bills.py
  frontend/pwa/js/auth.js
  frontend/pwa/js/app.js
  frontend/pwa/pages/bill.js
  frontend/pwa/pages/orders-detail.js
  frontend/pwa/pages/bill-history.js (NEW)
  frontend/pwa/index.html

---
[2026-04-27 v1.50] PWA Mobile Billing — Full DB Fields + Finance Status Fix

WHAT CHANGED:
✅ app/api/pos_bills.py — PAY_MAP เพิ่ม credit_card + qr → status:'paid', shipping:'received_payment'
   (เดิม credit_card/qr ไม่มีใน PAY_MAP → default เป็น pending ผิด)
✅ frontend/pwa/pages/billing.js — rewrite pay sheet ให้ครบทุก field:
   - doc_type selector (ใบเสร็จ/ใบแจ้งหนี้/ใบจอง/ใบส่งของ)
   - pay_method ครบ 9 อย่าง (cash/transfer/credit_card/qr/cash_waiting/transfer_waiting/deposit/credit/pending)
   - discount input + discount_type (฿/%)
   - VAT selector (0%/7%) + vat_type (รวม/บวกเพิ่ม)
   - paid_amount field (แสดงเฉพาะเมื่อ deposit)
   - live total summary (subtotal → discount → VAT → ยอดรวม)
   - ลบ hardcoded status:'paid' → ให้ backend คำนวณจาก PAY_MAP
   - โหลด store settings สำหรับ VAT mode default
   - หลังออกบิล → navigate ไป bill list (ไม่ใช่ orders)
   - เก็บ note/customer state ผ่าน module-level vars (ไม่หายเมื่อ re-render)
✅ frontend/pwa/index.html — bump v=2937 (billing.js)

STATUS FLOW (PAY_MAP):
  cash/transfer/credit_card/qr → paid + received_payment
  cash_waiting/transfer_waiting → paid + paid_waiting
  deposit                       → partial + deposit_waiting
  credit                        → credit + scheduled
  pending                       → pending + null

FILES CHANGED:
  app/api/pos_bills.py
  frontend/pwa/pages/billing.js
  frontend/pwa/index.html

Version: v1.50 | Updated: 2026-04-27

### [v1.51 COMPLETED — 2026-04-28] Mobile LINE Settings Page

งานที่ทำ:
- สร้างหน้า line.js (PWA page) สำหรับตั้งค่า LINE OA บนโมบาย
  - Section 1: ข้อมูลการเชื่อมต่อ (OA ID, Channel Token, Channel Secret)
  - Section 2: Webhook URL พร้อมปุ่มคัดลอก
  - Section 3: ฟีเจอร์ (bill/quote/chat/order toggles, chat_label, chat_action)
  - Section 4: การแจ้งเตือน (notify_on_order/bill toggles, UID ผู้รับ + ดึงล่าสุด)
  - Section 5: ใบเสนอราคา (QR upload, contact, note)
- pos.js: เปลี่ยนไอคอน 💚 เป็น LINE badge สีเขียว #06C755 + เปลี่ยน route จาก 'shop' เป็น 'line'
- more.js: เพิ่ม "เชื่อมต่อ LINE" ใน section ตั้งค่า พร้อม LINE icon
- index.html: เพิ่ม <script src="/pwa/pages/line.js">

API ที่ใช้ (ไม่สร้าง DB ใหม่):
  GET  /api/pos/line/settings
  POST /api/pos/line/credentials
  POST /api/pos/line/features
  POST /api/pos/line/quote-config
  POST /api/pos/line/upload-quote-qr
  GET  /api/line/pending-uid

FILES CHANGED:
  frontend/pwa/pages/line.js  (NEW)
  frontend/pwa/pages/pos.js
  frontend/pwa/pages/more.js
  frontend/pwa/index.html

Version: v1.51 | Updated: 2026-04-28

[v1.51.1 COMPLETED — 2026-04-28] Stock Check + PWA Bank Page
PC create.html — stock_empty_sell check:
✅ โหลด stock_empty_sell จาก store settings ตอน init
✅ addProduct() — ถ้า setting=false + track_stock=true + stock_qty≤0 → alert "สินค้า [ชื่อ] หมด กรุณาเพิ่มสินค้าในสต็อก" + block
✅ submitBill() — double-check ทุกรายการก่อน submit
PWA billing.js — stock_empty_sell check:
✅ โหลด store settings พร้อม products ใน Promise.all
✅ สินค้าหมด → แสดงการ์ดจาง + ป้าย "หมด" + กดไม่ได้ (แยก inStock/outStock)
✅ ปุ่มวิธีชำระกลุ่ม "ชำระแล้ว" 4 ปุ่ม — พื้นหลังเขียวอ่อนก่อนกด
PWA billing.js — form เพิ่มสมาชิก:
✅ เพิ่ม field ครบ: รหัสลูกค้า, Tax ID, วันเกิด, ที่อยู่, หมายเหตุ
✅ saveNewMember() ส่ง field ครบไป /api/pos/members/create
PWA bank.js (NEW):
✅ สร้างหน้าบัญชีธนาคาร Router bank
✅ list/add/edit/delete/setDefault บัญชี (สูงสุด 3)
✅ อัปโหลด QR Code พร้อม preview ใช้ /api/pos/bank/upload-qr/{bid} และ /api/pos/bank/upload-qr-new
✅ ดึงข้อมูล DB เดียวกับ PC (ไม่สร้าง DB แยก)
✅ แก้ pos.js more sheet ชี้ "ธนาคาร" → Router.go('bank')

[v1.51.2 COMPLETED — 2026-04-28]
PC create.html — stock_empty_sell:
✅ โหลด stock_empty_sell จาก store settings
✅ block สินค้าหมด + alert "สินค้า [ชื่อ] หมด กรุณาเพิ่มสินค้าในสต็อก"
✅ double-check ก่อน submit
PWA billing.js:
✅ สินค้าหมด → การ์ดจาง + ป้าย "หมด" กดไม่ได้ (inStock/outStock)
✅ ปุ่มชำระแล้ว 4 ปุ่ม พื้นหลังเขียวอ่อน
✅ form เพิ่มสมาชิก ครบทุก field (รหัส/Tax ID/วันเกิด/ที่อยู่/หมายเหตุ)
✅ saveNewMember() ส่ง field ครบ
PWA bank.js (NEW):
✅ หน้าบัญชีธนาคาร list/add/edit/delete/setDefault
✅ อัปโหลด QR Code + preview
✅ ใช้ DB เดียวกับ PC (ไม่สร้างแยก)
✅ pos.js more sheet → "ธนาคาร" ชี้ Router.go('bank')
PWA staff.js (NEW):
✅ หน้าบุคลากร list/สร้าง/แก้ไข
✅ จัดการสิทธิ์ครบทุก group (POS/รายงาน/Chat/ตั้งค่า/AutoPost)
✅ เปลี่ยนรหัสผ่าน
✅ pos.js more sheet → "บุคลากร" ชี้ Router.go('staff')
✅ ใช้ /api/staff/* DB เดียวกับ Superboard
PC settings/store.html:
✅ เพิ่ม Shop ID field ใต้ชื่อร้าน + ปุ่มคัดลอก
✅ ดึง tenant_id จาก JWT token
Superboard index.html:
✅ shop switcher แสดงโลโก้ + ชื่อร้าน + tenant_id
✅ ปุ่ม "+ เพิ่มร้านสาขา" (Coming Soon)
✅ ดึงข้อมูลจาก /api/pos/store/settings (มี logo_url ครบ)
Superboard theme.css:
✅ font-size +2px ทุกส่วน

FILES CHANGED:
frontend/pwa/pages/billing.js
frontend/pwa/pages/bank.js        (NEW)
frontend/pwa/pages/staff.js       (NEW)
frontend/pwa/pages/pos.js
frontend/pwa/js/auth.js           (DEV_TOKEN → tenant จริง)
frontend/pwa/index.html
frontend/superboard/index.html
frontend/superboard/css/theme.css
modules/pos/merchant/ui/dashboard/settings/store.html
modules/pos/merchant/ui/dashboard/billing/create.html

กำลังจะทำ (ลำดับ Priority):
1. 🔴 POST /api/staff/login — staff login endpoint
2. 🔴 Blue/Green deployment scripts
3. 🟡 pos.js more sheet — ลบเมนูซ้ำ + เพิ่ม Delivery
4. 🟡 billing.js v1.50 เต็ม (doc_type/pay/discount/VAT)
5. 🟡 ทดสอบ 4-5 บัญชีจริง

สรุปวันนี้ เพิ่มใน VIIV_MASTER.md Section [E] v1.51.3:
- Superboard connections.html (LINE + Coming Soon tabs)
- sidebar เพิ่ม "การเชื่อมต่อ" ก่อนบุคลากร
- store.html ลบ tab LINE
- fix more.js JSON.stringify onclick
- fix auth.js atob padding + DEV_TOKEN ten_1