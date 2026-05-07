# VIIV MASTER — Project Reference
> **copy ไฟล์นี้ทั้งหมดเพื่อเปิดแชทใหม่ทุกครั้ง**  
> Version: v3.0 | Updated: 2026-05-01 | Git Latest: 774b755  
> Claude Code อัปเดต Section [J] ทุกสิ้นวัน
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
Staff Login Architecture (v1.52)
```
endpoint:  POST /api/staff/login
table:     tenant_staff (id, tenant_id, email, hashed_password, role,
                          first_name, last_name, is_active)
JWT:       sub=staff_id, tenant_id, role, name, exp=8hr
rate limit: 5 attempts/min per ip:email (in-memory dict)
lib:       passlib CryptContext(bcrypt) + PyJWT encode HS256
frontend:  frontend/superboard/login.html → /api/staff/login
test acct: aaa@gmail.com / viiv1234 / tenant ten_1 / role:MD
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

# Platform AI manager (2026-05-01)
GET    /api/platform/ai/stats              ✅
GET    /api/platform/ai/keys               ✅
POST   /api/platform/ai/keys               ✅
DELETE /api/platform/ai/keys/{provider}    ✅
GET    /api/platform/ai/models             ✅
GET    /api/platform/ai/log                ✅
PATCH  /api/platform/ai/credit/{tid}       ✅

# Chat module (proxy via Caddy → :8003)
GET    /chat/conversations                 ✅
GET    /chat/conversations/{id}/messages   ✅
POST   /chat/conversations/{id}/reply      ✅
PATCH  /chat/conversations/{id}/bot        ✅
GET    /chat/bot/settings                  ✅
POST   /chat/bot/settings                  ✅
GET    /chat/stats                         ✅
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

---

### [v1.52 COMPLETED — 2026-04-28]

✅ Superboard connections.html — LINE tab เต็ม (OA ID, Token, Secret, Webhook URL, features toggles)
   + Facebook / TikTok / IG / YouTube / API Keys แสดง "Coming Soon" tabs
✅ Superboard index.html sidebar — เพิ่มเมนู "การเชื่อมต่อ" ก่อนบุคลากร
✅ PC settings/store.html — ลบ tab LINE ออก (เหลือ 3 tabs: ทั่วไป / สโตร์ / เพิ่มเติม)
✅ PWA more.js — เพิ่ม 5 social menus (LINE/Facebook/IG/TikTok/YouTube) + comingsoon.js page
✅ fix more.js — onclick ใน innerHTML ที่มี JSON.stringify() ทำให้ quote หลุด → แก้ด้วย data-attr pattern
✅ fix auth.js — atob base64 padding bug + DEV_TOKEN tenant ten_1 (role MD, sub stf_xxx)
✅ POST /api/staff/login — bcrypt verify + PyJWT 8hr + rate limit 5/min per ip:email
   - table: tenant_staff | lib: passlib+PyJWT | ไม่แตะ ORM ใช้ raw SQL engine.connect()
✅ frontend/superboard/login.html — wired to /api/staff/login
   - 401/404 → "อีเมลหรือรหัสผ่านไม่ถูกต้อง" | 429 → data.detail | tenant_id='ten_1'
✅ PWA billing.js — price adjustment per item down to price_min floor (price_min stored in cart item)
   - setPrice() updates DOM in-place (cart-price-i / cart-total-i / bill-total-amt) — no _renderCart() call
   - fix: email input flickering caused by full _renderCart() re-render on every price change
✅ PWA billing.js — mandatory customer selection on all bill creation points
   - confirmBill() blocks if !_customer + price_min final validation
   - pay sheet: "* บังคับ" red label next to "ลูกค้า"
✅ "M" badge — bills created from mobile (source='pwa') marked inline with bill_no
   - PWA bill.js: list + detail views
   - PC: orders/all.html, orders/payment.html, orders/shipping.html
   - PC: sales/today.html, sales/advance.html, sales/search.html
✅ app/api/pos_bills.py — delete_bill fix: json.dumps() on bill.items (JSONB auto-parsed by psycopg2)
✅ app/api/pos_statements.py — unpaid-bills + {sid}/bills: customer_data fallback chain
   - bills[0] fallback in _openDetail for PWA-created bills missing customer_name column
✅ frontend/pwa/pages/statement.js — customer lock using __NONE__ sentinel (null = "locked to no customer")

FILES CHANGED:
  app/api/login.py
  app/api/pos_bills.py
  app/api/pos_statements.py
  frontend/superboard/login.html
  frontend/pwa/pages/billing.js
  frontend/pwa/pages/bill.js
  frontend/pwa/pages/statement.js
  frontend/pwa/pages/more.js
  frontend/pwa/index.html
  modules/pos/merchant/ui/dashboard/orders/all.html
  modules/pos/merchant/ui/dashboard/orders/payment.html
  modules/pos/merchant/ui/dashboard/orders/shipping.html
  modules/pos/merchant/ui/dashboard/sales/today.html
  modules/pos/merchant/ui/dashboard/sales/advance.html
  modules/pos/merchant/ui/dashboard/sales/search.html

Version: v1.52 | Updated: 2026-04-28

Superboard Connections Page:

สร้าง frontend/superboard/pages/connections.html — LINE tab เต็ม + Facebook/TikTok/IG/YouTube/API Keys Coming Soon
index.html เพิ่ม sidebar "การเชื่อมต่อ" ก่อนบุคลากร
store.html ลบ tab LINE ออก (เหลือ 3 tabs)

PWA more.js:

เพิ่ม Facebook/TikTok/IG/YouTube/API Keys → comingsoon
สร้าง comingsoon.js PWA page
fix onclick JSON.stringify undefined bug

Auth & Login:

fix auth.js atob base64 padding
fix DEV_TOKEN tenant_id คืนเป็น ten_1
POST /api/staff/login — bcrypt + PyJWT 8hr + rate limit 5/min
login.html wired to /api/staff/login
test account: aaa@gmail.com / viiv1234 / ten_1 / role:MD
fix profileName อ่านจาก JWT → แสดง "Mtest"

Rules เพิ่ม:
Rule 59 — dashboard/index.html JS anchor คือ "vDash = {" ไม่ใช่ "window.vDash = {"
Rule 60 — patch dashboard ต้องทำผ่าน Claude Code เท่านั้น ห้าม patch ผ่าน AI แชท

### [v1.53 COMPLETED — 2026-04-29] Connections Menu + Platform Status Widget Move

✅ modules/pos/merchant/ui/dashboard/dashboard.html
   - เพิ่มเมนู "การเชื่อมต่อ" ลำดับที่ 11 (ก่อน จัดการร้านค้า)
   - เพิ่ม PAGES.connections → loadSubPage('connections/main.html')
   - connections/main.html: LINE tab เต็ม + Facebook/TikTok/IG/YouTube/API Keys Coming Soon

✅ frontend/superboard/index.html
   - ลบ Platform Status Widget ออกจาก topbar (#sb-platform-status div)
   - ลบ CSS .psw-item/.psw-icon/.psw-dot/.psw-grey/.psw-green
   - ลบ JS pswSet() + pswLoad()

✅ frontend/superboard/dashboard/style.css
   - เพิ่ม .hp-item/.hp-icon/.hp-dot CSS
   - connected = สีเขียว / grey = จาง / warning/error + animation

✅ frontend/superboard/dashboard/index.html
   - #hub-platforms: แก้ position จาก top:10px → top:calc(var(--hh)+8px) (ใต้ header)
   - ลบ hardcoded class "connected" บน hp-line (JS ตั้งจาก API)
   - เพิ่ม onclick → window.parent.sbNav('connections')
   - title="คลิกเพื่อจัดการการเชื่อมต่อ"

✅ frontend/superboard/dashboard/app.js
   - เพิ่ม hpLoad() — fetch /api/pos/line/settings → set hp-line.connected
   - เรียก hpLoad() ใน init()

FILES CHANGED:
  modules/pos/merchant/ui/dashboard/dashboard.html
  frontend/superboard/index.html
  frontend/superboard/dashboard/style.css
  frontend/superboard/dashboard/index.html
  frontend/superboard/dashboard/app.js

Version: v1.53 | Updated: 2026-04-29

[v1.53 COMPLETED — 2026-04-29]
DASHBOARD LAYOUT FIX:

แก้ bug #hdr display:none ใน dashboard/app.js (if window.self !== window.top)
ลบ #hdr ออกจาก dashboard เพราะย้าย staff ขึ้น Superboard topbar แล้ว
เพิ่ม #tab-platforms CSS ให้แสดงเป็นแถวแนวนอน
แก้ #canvas layout: left:0, padding-left:0 → center grid ถูกต้อง
แก้ Cache-Control header บน /superboard/* ใน Caddyfile

STAFF ONLINE WIDGET (Superboard Topbar):

เพิ่ม #sb-staff-wrap ใน superboard/index.html (ซ้ายปุ่ม AI)
Avatar สีต่างกันตาม index + green dot แสดง online
รับ postMessage staff_update จาก dashboard iframe
ส่ง interval ทุก 5 วินาทีจาก dashboard

STAFF PRESENCE SYSTEM (Backend):

เพิ่ม column last_seen timestamptz ใน tenant_staff table
POST /api/staff/heartbeat — อัปเดต last_seen
GET /api/staff/presence — ดึง staff + is_online (last_seen > 60 นาที)
Dashboard ส่ง heartbeat ทุก 60 วินาที ผ่าน localStorage token
Superboard poll /api/staff/presence ทุก 60 วินาที
Border avatar เปลี่ยนสีตาม online/offline

PLATFORM STATUS WIDGET:

ย้ายจาก Superboard topbar → dashboard tabbar (ใต้ topbar)
#tab-platforms แสดงเป็นแถวกลางหน้า
ลบ #hdr ออกจาก dashboard index.html

JWT:

ขยาย exp จาก 8 ชั่วโมง → 30 วัน (ไม่ต้อง login บ่อย)

FILES CHANGED:
app/api/tenant_staff.py     (+heartbeat, +presence endpoints)
app/api/login.py            (exp 8hr → 30days)
frontend/superboard/index.html
frontend/superboard/dashboard/index.html
frontend/superboard/dashboard/app.js
frontend/superboard/dashboard/style.css
/etc/caddy/Caddyfile        (Cache-Control /superboard/*)
RULES เพิ่ม:

Rule 59 — dashboard/index.html JS anchor คือ vDash = { ไม่ใช่ window.vDash = {
Rule 60 — patch dashboard ต้องทำผ่าน Claude Code เท่านั้น
Rule 61 — ทุกครั้งที่แก้ Superboard ต้อง bump version timestamp

KNOWN ISSUES:

staff_update postMessage จาก dashboard ทับ presence avatar ทุก 5 วินาที (แก้แล้วด้วย guard)
heartbeat ใน dashboard อ่าน token จาก localStorage โดยตรง (ไม่ผ่าน postMessage)

Version: v1.53 | Updated: 2026-04-29

### [v1.54 COMPLETED — 2026-04-29] Platform Status Widget — Final Architecture

SUMMARY: ย้าย Platform Status Widget ออกจาก Superboard topbar ลงไปอยู่ใน Dashboard iframe
และย้าย Staff Online Widget จาก Dashboard header ขึ้นไปอยู่ใน Superboard topbar แทน

PLATFORM STATUS WIDGET (dashboard/index.html):
- `#tab-platforms` แสดงเป็นแถบเต็มความกว้างด้านบนสุดของ iframe (top:0, z-index:190)
- มี 5 platforms: LINE OA / Facebook / TikTok / Instagram / YouTube
- คลิกทั้งแถบ → `window.parent.sbNav('connections')` นำทางไปหน้า Connections
- `#canvas` เริ่มที่ `top:var(--ph)` (ใต้แถบ platform เท่านั้น ไม่มี header ซ้อน)
- `#hdr` ถูกลบออกจาก dashboard แล้ว — Superboard topbar ทำหน้าที่แทน

STAFF ONLINE WIDGET (superboard/index.html):
- `#sb-staff-wrap` อยู่ใน `.sb-top-actions` ก่อนปุ่ม bell
- IDs: `#sb-staff-avatars` (avatar row) + `#sb-staff-count` (count text)
- Poll `/api/staff/presence` ทุก 60 วินาที (ไม่พึ่ง postMessage จาก iframe)
- รับ `postMessage staff_update` จาก dashboard เป็น fallback

DASHBOARD GRID (dashboard/style.css):
- `#grid`: `1fr 160px 1fr` / `1fr 80px 1fr` / `min(1380px,100%)` × `min(690px,100%)`
- Fluid layout ไม่ fixed px — ปรับตาม viewport

FILES CHANGED:
  frontend/superboard/dashboard/index.html  (ลบ #hdr, #tab-platforms top:0)
  frontend/superboard/dashboard/style.css   (canvas top:var(--ph), grid fluid)
  frontend/superboard/index.html            (#sb-staff-wrap + presence JS)

Version: v1.54 | Updated: 2026-04-29

---

### [v1.55 COMPLETED — 2026-04-29] Platform Dashboard — Full PC Shell + Page Isolation + Connections Module

SUMMARY: สร้าง Platform Dashboard ใหม่ทั้งหมดแบบ PC-only shell ที่โหลดแต่ละเมนูเป็นไฟล์แยก
พร้อม error isolation ต่อเมนู และสร้าง Connections module (LINE) ที่บันทึกลง DB จริง

PLATFORM DASHBOARD SHELL (frontend/platform/dashboard.html):
- PC-only: min-width 1200px, dark sidebar 240px, white topbar 56px
- `loadPage(name)` fetch `/platform/pages/{name}.html` + try/catch error boundary
- ถ้าเมนูพัง จะ error เฉพาะ content area ไม่กระทบเมนูอื่น
- Hash routing: `#shops`, `#overview`, `#connections` ฯลฯ
- Exposes `window.platformToken`, `window.platformNav`, `window.platformLoadPage`
- Font ขยายขึ้นทุก session: base 18px, sidebar items 17px, topbar title 19px

PLATFORM PAGE FILES (frontend/platform/pages/):
- overview.html   — Stats 4 ช่อง + กิจกรรมล่าสุด + System Status
- shops.html      — Shop table + Manage modal (7 accordion sections) + mock fallback
- packet.html     — Cards Starter/Pro/Enterprise
- finance.html    — รายรับ + transaction table
- orders.html     — Orders table + search
- ai.html         — AI stats + toggle per shop
- notify.html     — ส่งแจ้งเตือน + ประวัติ
- apikeys.html    — API key management + revoke
- logs.html       — Terminal-style log viewer + filter
- myshop.html     — ข้อมูลร้าน + ยอดขาย + ตั้งค่า
- connections.html — LINE connection + QR upload (ใหม่ v1.55)

CONNECTIONS MODULE — LINE OA (v1.55 ใหม่):
- Backend: `app/api/platform_connections.py`
  - สร้างตาราง `platform_connections` อัตโนมัติ (5 rows: line/fb/tiktok/ig/yt)
  - GET/POST `/api/platform/connections/{platform}`
  - POST `/api/platform/connections/{platform}/upload-qr` → บันทึกไฟล์ + URL
  - DELETE `/api/platform/connections/{platform}/qr`
- Frontend: connections.html
  - Tab: LINE / Facebook / TikTok / Instagram / YouTube
  - Status banner (connected/disconnected ตาม channel_token)
  - OA ID → auto-generate line.me link
  - QR image upload → preview + shareable URL + copy button
  - Webhook URL display + copy
- Sidebar: เพิ่ม "🔗 เชื่อมต่อ" ใต้ ตั้งค่าระบบ (indent sub-item)

MANAGE DRAWER (shops.html — ปรับรูปแบบ):
- เปลี่ยนจาก side drawer → centered modal ขนาดใหญ่ min(1080px,100vw)
- Layout 2 คอลัมน์: ซ้าย info panel (สีเทาดำเข้ม #374151), ขวา 7 accordion sections
- Mock fallback: เมื่อ API ยังไม่พร้อม แสดง 2 แถว demo ให้ปุ่มจัดการใช้งานได้

DB TABLES CREATED:
  platform_connections — platform-level LINE/social credentials + QR storage

FILES CHANGED:
  frontend/platform/dashboard.html              (shell + font size + sidebar connections)
  frontend/platform/pages/connections.html      (NEW — LINE connection management)
  frontend/platform/pages/shops.html            (modal redesign + mock fallback)
  frontend/platform/pages/overview.html         (NEW)
  frontend/platform/pages/packet.html           (NEW)
  frontend/platform/pages/finance.html          (NEW)
  frontend/platform/pages/orders.html           (NEW)
  frontend/platform/pages/ai.html               (NEW)
  frontend/platform/pages/notify.html           (NEW)
  frontend/platform/pages/apikeys.html          (NEW)
  frontend/platform/pages/logs.html             (NEW)
  frontend/platform/pages/myshop.html           (NEW)
  app/api/platform_connections.py               (NEW)
  app/main.py                                   (register platform_connections router)

Version: v1.55 | Updated: 2026-04-29

---

### [v1.56 COMPLETED — 2026-04-30] Platform Auth Migration + Security Module + Landing Page

SUMMARY: ย้าย platform owner login จาก tenant_staff → platform_users, ลบ DEV_TOKEN ทั้งระบบ,
เพิ่ม Security menu + Token Users page, แก้ viiv.me landing page + register flow

AUTH MIGRATION — platform_users:
- app/api/login.py: POST /api/platform/login ใหม่
  - query platform_users (ไม่ใช่ tenant_staff แล้ว)
  - JWT payload: {user_id, email, role:"owner", tenant_id, exp}
  - bcrypt verify เท่านั้น — ลบ plain-text fallback ออกหมด
  - migrate DB: hashed_password ทุก row ให้เป็น bcrypt ก่อน remove fallback
- app/api/platform_connections.py: GET /api/platform/my-shops
  - owned shops (tenants WHERE owner_id=user_id)
  - staffed shops (tenant_staff JOIN tenants WHERE email=email)
  - dedup by tenant id, return role per shop

TOKEN KEY MIGRATION (viiv_token → platform_token):
- frontend/platform/login.html       — TOKEN_KEY + fetch endpoint
- frontend/platform/js/core/auth.js  — TOKEN_KEY constant
- frontend/platform/dashboard.html   — getToken() ลบ viiv_token fallback
- frontend/platform/pages/shops.html — tok() + mock fallback ลบ ten_1/ten_2
- frontend/platform/pages/packet.html— tok()
- frontend/platform/pages/settings.html — getItem/removeItem/getItem
- frontend/platform/pages/register-shop.html — getItem x2

SUPERBOARD FIX:
- frontend/superboard/login.html: เพิ่ม Tenant ID input field
  แทน hardcoded tenant_id:'ten_1' → อ่านจาก input

DEV_TOKEN REMOVAL (PWA + Merchant):
- frontend/pwa/js/auth.js: ลบ DEV_TOKEN constant ทั้งหมด
  - ไม่มี token: iframe → postMessage parent | top-level → redirect /platform/login.html
  - fallbackToken(): clear + redirect login (ไม่ใช่ set DEV_TOKEN)
  - logout(): redirect /platform/login.html
- frontend/pwa/js/app.js:
  - tenantId: hardcoded 'ten_1' → getter อ่าน JWT payload
  - ShopSwitcher: d.tenant_id || App.tenantId || '' (ไม่ fallback 'ten_1')
- modules/pos/merchant/ui/dashboard/dashboard.html:
  - ลบ DEV_TOKEN bootstrap block
  - ถ้าไม่มี viiv_token → redirect /platform/login.html

SECURITY MODULE (ใหม่):
- frontend/platform/dashboard.html: เปลี่ยน System Logs → Security (accordion parent)
  Sub-items: System Logs + Token Users (data-parent="sb-security-parent")
  routeHash() ใช้ sub.dataset.parent แทน hardcoded ID
- frontend/platform/pages/security-tokens.html (NEW):
  Table 6 คอลัมน์: user/tenant, IP, user_agent, last_action, last_seen, actions
  Stats pills: total / online(1hr) / flagged
  Row inactive >1hr = opacity 0.38; flagged = red left border + BLOCKED badge
  Block (toggle unblock), Kick (confirm → DELETE log), Delete (confirm)
  Optimistic UI: update _data array → re-render
- app/api/platform_connections.py: 4 endpoints ใหม่
  GET  /api/platform/tokens        — list token_security_log + JOIN platform_users.email
  POST /api/platform/tokens/{id}/block  — flagged=true, flagged_reason='manual_block'
  POST /api/platform/tokens/{id}/kick   — DELETE row
  DELETE /api/platform/tokens/{id}      — DELETE row

QR / REGISTER FIX (viiv.me):
- app/api/platform_connections.py: UPLOAD_URL เปลี่ยนเป็น absolute https://viiv.me/platform/uploads
- frontend/register-success.html: fetch URL เปลี่ยนเป็น https://api.viiv.me/api/platform/...
- frontend/index.html: redesign warm brand (cream bg, gold CTA, hero+features+plans+footer)
- frontend/register.html: เปลี่ยนจาก iframe → fetch+inject pattern, professional layout
- frontend/register/index.html: symlink Caddy workaround สำหรับ /register route

DB TABLES USED:
  token_security_log    — list/block/kick/delete
  platform_users        — owner login + email JOIN
  tenants               — my-shops owned
  tenant_staff          — my-shops staffed

COMMITS (6 commits, branch main):
  9f9b79a  feat: platform_users migration + multi-tenant login flow
  79469aa  fix: remove plain-text password fallback, bcrypt-only verify
  b187bed  fix: platform_token + superboard tenant resolve
  d600305  fix: remove DEV_TOKEN + hardcoded ten_1 — PWA + merchant dashboard
  1d318c3  feat: security menu + token manager UI + block/kick/delete endpoints
  115587c  feat: landing page redesign + register flow fix (viiv.me)

FILES CHANGED:
  app/api/login.py                                    (platform_users login + bcrypt)
  app/api/platform_connections.py                     (my-shops + token endpoints + UPLOAD_URL)
  frontend/platform/login.html                        (platform_token + endpoint)
  frontend/platform/js/core/auth.js                   (platform_token)
  frontend/platform/dashboard.html                    (Security menu + routeHash fix)
  frontend/platform/pages/shops.html                  (platform_token + remove mock ten_1)
  frontend/platform/pages/packet.html                 (platform_token)
  frontend/platform/pages/settings.html               (platform_token x3)
  frontend/platform/pages/register-shop.html          (platform_token x2)
  frontend/platform/pages/security-tokens.html        (NEW)
  frontend/superboard/login.html                      (tenant input field)
  frontend/pwa/js/auth.js                             (remove DEV_TOKEN, redirect login)
  frontend/pwa/js/app.js                              (tenantId getter, remove ten_1)
  modules/pos/merchant/ui/dashboard/dashboard.html    (remove DEV_TOKEN bootstrap)
  frontend/index.html                                 (landing redesign)
  frontend/register.html                              (fetch+inject pattern)
  frontend/register-success.html                      (absolute api.viiv.me URL)
  frontend/register/index.html                        (NEW symlink)

Version: v1.56 | Updated: 2026-04-30

---

### [v1.57 COMPLETED — 2026-04-30] Subdomain Migration

SUMMARY: แยก Platform / Shop ตาม subdomain ครบ — concore.viiv.me = Platform Dashboard,
{subdomain}.viiv.me = Superboard ของร้านนั้น (PC), {subdomain}.viiv.me/pwa = PWA mobile,
backend resolve tenant_id จาก Host header ผ่าน DB lookup

CADDY (/etc/caddy/Caddyfile):
- concore.viiv.me block: เหลือ root frontend/platform/ + try_files /dashboard.html + /api /admin /uploads
  ลบ /platform/ /merchant/ /pwa/ ออก (concore = platform เท่านั้น)
- *.viiv.me block: root frontend/, try_files /superboard/index.html (Superboard ที่ root)
  + handle /pwa/* → root frontend/ + try_files /pwa/index.html (SPA routing PWA)
  @reserved = concore, auth, www, viiv → respond 444
  ลบ /merchant/ /superboard/ /modulpos/ /modulchat/ /modulepost/ (legacy)
  abort → respond 444
- ไฟล์เปลี่ยนผ่าน Caddyfile.new → sudo cp → caddy validate → reload

BACKEND (app/main.py):
- CORS: allow_origin_regex=r"https://([a-z0-9-]+\.)?viiv\.me$" แทน explicit list
- inject_tenant middleware ใหม่:
  - extract subdomain จาก Host header
  - skip RESERVED_SUBDOMAINS = {concore, auth, www, api, owner, merchant, viiv}
  - SELECT id FROM tenants WHERE subdomain = ? → tenant_id (cache process-level)
  - fallback: X-Tenant header → ?tenant_id query → "default"

SUPERBOARD (frontend/superboard/):
- pages/connections.html: ลบ hardcode https://concore.viiv.me/api/line/webhook
  → cnWebhookUrl() = window.location.origin + '/api/line/webhook' (per-shop)

PWA (frontend/pwa/):
- index.html: SW เปลี่ยนจาก unregister → register('/pwa/sw.js', {scope:'/pwa/'})
- pages/more.js: PC = window.location.origin + '/superboard/pages/'
                 Superboard Desktop link → window.location.origin + '/'
- pages/line.js: webhookUrl = ${window.location.origin}/api/line/webhook?tenant=...
- pages/pos.js:  catalog url = window.location.origin + '/catalog.html'

TENANTS AUDIT:
- 7/7 rows มี subdomain ครบ — ไม่ต้อง backfill
- test7 → ten_1, testshop → ten_2, testshop2..4, 1133, 4455 → uuid

SMOKE TEST (2026-04-30):
- concore.viiv.me/                       → 200 (Platform dashboard.html)
- concore.viiv.me/dashboard.html         → 200
- test7.viiv.me/                         → 200 (Superboard)
- test7.viiv.me/pwa/                     → 200 (PWA)
- test7.viiv.me/superboard/index.html    → 200
- _resolve_tenant_from_subdomain('test7') → 'ten_1' ✓
- _resolve_tenant_from_subdomain('testshop2') → 'ten_b317...' ✓

FILES CHANGED:
  Caddyfile.new                                   (NEW staging — user sudo cp → /etc/caddy/Caddyfile)
  app/main.py                                     (CORS regex + tenant resolver via DB)
  frontend/superboard/pages/connections.html      (LINE webhook = window.location.origin)
  frontend/pwa/index.html                         (SW register scope /pwa/)
  frontend/pwa/pages/more.js                      (PC = origin/superboard/pages/, Desktop link)
  frontend/pwa/pages/line.js                      (webhook URL hostname-based)
  frontend/pwa/pages/pos.js                       (catalog URL hostname-based)

Version: v1.57 | Updated: 2026-04-30

---

### [v1.58 COMPLETED — 2026-04-30] Auth Loop Fixes + Platform UX + Module Iframe + Superboard Login

SUMMARY: เคลียร์ redirect loop ทั้งระบบ (login ↔ dashboard), เพิ่ม token
validate endpoint + 401 interceptor, refactor superboard login เป็น
multi-shop picker, เปลี่ยน switchMod เป็น iframe fullscreen, เคลียร์
Caddy /platform/* routing, ลบ legacy fix_*/patch_* scripts ออกจาก repo

CHORE — REPO CLEANUP:
- ลบ 12 ไฟล์ one-time migration scripts ที่ root: fix_auth*.py, fix_more*.py,
  fix_devtoken.py, fix_index_comingsoon.py, patch_billing_*.py,
  patch_platform_widget.py — ใช้ครั้งเดียวแล้วทิ้ง zero references
  (commit ea9e504, -679 lines)

AUTH FLOW (commits 5c02455, f674e13, a5d2455, ba05963):
- frontend/platform/js/core/auth.js:
  - isLoginPage() guard — requireAuth/logout ไม่ redirect ตัวเองถ้าอยู่ login
  - handle401() helper สำหรับ ES module consumers
- frontend/platform/login.html:
  - validate token ผ่าน fetch /api/platform/me ก่อน redirect dashboard
  - 200 → dashboard | !ok / catch → ลบ token stay on login (กัน loop ผ่าน
    token เก่า/หมดอายุ)
- frontend/platform/dashboard.html:
  - global fetch interceptor: ดัก 401 จาก /api/* → ลบ token + redirect login
  - _origFetch + _redirecting flag (re-entry guard) ยกเป็น module-level
  - skip /api/platform/me ใน interceptor (validate, ไม่ใช่ session expired)
  - init() เปลี่ยนจากตรวจ getToken() เฉยๆ → fetch /me validate ก่อน routeHash
  - loadPage script injection guard: skip script ที่มี location.hash (กัน
    hashchange → routeHash → nav → loop)
- frontend/pwa/js/auth.js: 3 redirect points ทั้งหมดใช้ absolute URL
  https://concore.viiv.me/platform/login.html (relative ไม่ทำงานบน
  shop subdomain เพราะ wildcard ไม่มี /platform/* handler)

PLATFORM ENDPOINTS (commits f674e13, 8254ee6):
- ย้าย GET /api/platform/me จาก login.py → platform_connections.py
  decode JWT → return {user_id, email, role}
  401 ถ้า missing/invalid token
- เพิ่ม GET /api/platform/health → {status:"ok", version:"1.54"} public
- เพิ่ม GET /api/platform/overview → empty stats stub (token-tolerant)
- frontend/platform/pages/security-tokens.html: tkLoad() ใช้ inline fetch +
  Authorization header แทน api() helper (กัน context สูญหายตอน loadPage)

PLATFORM DASHBOARD UX (commit 51f16b3):
- navParent() ลบการเรียก nav(el) → เป็นแค่ accordion toggle (.open + .expanded)
- เหตุผล: parent items (security, settings) ไม่มีไฟล์ pages/{name}.html
  Caddy try_files fallback → ส่ง dashboard.html → loadPage inject ตัวเอง
  ซ้อน → const re-declare → SyntaxError → UI เพี้ยน

SUPERBOARD LOGIN (commit b1ab60e):
- POST /api/staff/login: tenant_id เป็น optional
  JOIN tenants เพื่อดึง store_name + filter rows ที่ password ตรง
  1 row → ออก token เลย, >1 row + ไม่ระบุ tenant_id → return select_shop
- frontend/superboard/login.html: ลบ field Tenant ID ออก
  เพิ่ม shop picker UI: backend ตอบ select_shop → list ร้าน + role
  user เลือก → re-POST login พร้อม tenant_id (เก็บ email/pass ใน memory)

SUPERBOARD SWITCH MODULE (commits 8610397, b5a5a74, 040d1b6):
- switchMod() เปลี่ยนจาก sbNav(page) → iframe เต็มพื้นที่
  pos: /modules/pos/merchant/ui/dashboard/dashboard.html
  chat/autopost: ไม่มีไฟล์ → แสดง 🚧 Coming Soon
- iframe ใช้ position:absolute + inset:0 + width/height 100%
- #sbContent override .sb-content (theme.css):
  position:relative, flex:1, overflow:hidden, padding/margin:0,
  width/height 100%
- #sbContent > iframe { max-width: none } ปลด .sb-content > * { max-width:
  1200px } ที่ clip iframe บนจอใหญ่

CADDY (commits e62eba5, b28690f, b5a5a74):
- concore.viiv.me block:
  - เปลี่ยน root จาก frontend/platform/ → frontend/ + handle /platform/*
    + try_files /platform/dashboard.html (เดิม root resolve /platform/css/...
    เป็น frontend/platform/platform/css/... → 404 → fallback dashboard.html
    → CSS ได้ HTML content)
  - root concore.viiv.me/ → redir /platform/login.html 302
  - เพิ่ม handle /logs/* → root /home/viivadmin/viiv (สำหรับ logs.html อ่าน
    /logs/uvicorn.log)
- *.viiv.me block: เพิ่ม handle /modules/* → root /home/viivadmin/viiv
  สำหรับ POS iframe จาก superboard switchMod()

ASSET PATH AUDIT:
- ตรวจ frontend/platform/ ครบ — ทุก src/href/fetch/window.location.href
  ใช้ /platform/... prefix อยู่แล้ว ไม่ต้องแก้

SMOKE TEST (2026-04-30):
- /api/platform/me valid → 200 {user_id,email,role}
- /api/platform/me invalid/missing → 401
- /api/platform/health → 200
- /api/platform/overview no token → 200 empty stats (ไม่ throw 401)
- /api/staff/login no tenant_id + email มี 1 row → 401 password
- _resolve_tenant_from_subdomain('test7') → 'ten_1'
- concore.viiv.me/ → 302 login | /platform/login.html → 200
- test7.viiv.me/, /pwa/, /superboard/index.html → 200
- /modules/pos/merchant/ui/dashboard/dashboard.html → 200 (จาก wildcard)

COMMITS (13 commits, branch main):
  ea9e504  chore: remove one-time migration scripts (fix_* patch_*)
  5c02455  fix: auth redirect loop on login page
  f674e13  fix: token validation on login + 401 handler + /api/platform/me
  b1ab60e  fix: superboard login — remove tenant_id field, auto-resolve shop
  a5d2455  fix: dashboard init validate token + interceptor re-entry guard +
           script injection guard
  8610397  fix: switchMod POS → iframe dashboard, not SPA page
  8254ee6  fix: add /api/platform/health and /api/platform/overview endpoints
  e62eba5  fix: caddy concore /platform/* routing — login.html serves correctly
  b5a5a74  fix: superboard switchMod iframe fullscreen + chat/autopost coming soon
  040d1b6  fix: sbContent fullscreen — remove max-width/padding, iframe inset 0
  51f16b3  fix: platform security accordion — parent toggles only, no navigate
  b28690f  fix: security-tokens auth header + logs caddy handler
  ba05963  fix: PWA auth redirect → absolute concore.viiv.me/platform/login.html

FILES CHANGED:
  Caddyfile.new                                    (concore /platform/*, /logs/* +
                                                    wildcard /modules/*)
  app/main.py                                      (CORS regex, tenant resolver)
  app/api/login.py                                 (refactor /staff/login multi-shop,
                                                    move /platform/me)
  app/api/platform_connections.py                  (+/me, /health, /overview)
  frontend/platform/login.html                     (token validate via /me)
  frontend/platform/dashboard.html                 (interceptor + init validate +
                                                    script injection guard +
                                                    navParent accordion-only)
  frontend/platform/js/core/auth.js                (isLoginPage guard + handle401)
  frontend/platform/pages/security-tokens.html     (inline fetch + auth header)
  frontend/superboard/index.html                   (switchMod iframe + #sbContent
                                                    fullscreen CSS)
  frontend/superboard/login.html                   (remove Tenant ID, shop picker)
  frontend/pwa/js/auth.js                          (absolute URL redirect)
  -- removed --
  fix_auth.py, fix_auth2.py, fix_more.py, fix_more2.py, fix_more3.py,
  fix_devtoken.py, fix_index_comingsoon.py,
  patch_billing_rendercard.py, patch_billing_stock2.py,
  patch_billing_stock3.py, patch_billing_stock4.py,
  patch_platform_widget.py

Version: v1.58 | Updated: 2026-04-30

---

### [v1.59 COMPLETED — 2026-04-30] Cross-Origin SSO + Device-Aware Login Redirect

SUMMARY: viiv.me/login กลายเป็น single entry point ของระบบ — login เสร็จ
ดึง shops list, redirect ไปร้านที่เหมาะสมพร้อมส่ง token ข้าม origin
ผ่าน URL param. detect device → desktop ไป /superboard/, mobile ไป /pwa/.
แก้ปัญหา localStorage แยก origin (viiv.me ↔ {sub}.viiv.me) ที่ทำให้
SSO ไม่ทำงานหลัง subdomain migration

PWA REDIRECT URL (commits 60220cb, 34a6c22):
- frontend/pwa/js/auth.js: ทุก redirect (init, fallbackToken, logout)
  เปลี่ยนจาก https://concore.viiv.me/platform/login.html
  → https://viiv.me/login.html
  เหตุผล: concore = platform admin เท่านั้น, end-user PWA ควรไป
  landing page หลัก
- frontend/pwa/index.html: เพิ่ม early redirect
  if (!location.hash) location.replace('/pwa/#home')
  ก่อน App.init() — บังคับ URL bar เป็น #home ตั้งแต่ต้น (Router.init
  เดิมใช้ replaceState fallback ที่อาจ desync)

LOGIN.HTML REFACTOR (commit 84455a3):
- ลบ auto-redirect ตอน load login.html — ผู้ใช้เห็นฟอร์มเสมอ
- เปลี่ยน endpoint POST /api/login → /api/platform/login
  (เดิมส่ง TokenResponse เฉยๆ ไม่มี shops; ใหม่ได้ shops + subdomain)
- เปลี่ยน token key viiv_token → platform_token (consistent)
- redirect logic หลัง login:
  - shops.length === 1 → goShop(shop.subdomain)
  - shops.length  > 1 → showShopPicker(shops) — list ใน card
  - shops.length === 0 → /register.html
- handle 429 (rate limit), 404 (email ไม่พบ) แยกข้อความ
- เพิ่ม shopPicker UI inline ใน card (avatar + store_name + subdomain
  + status + hover effect)

CROSS-ORIGIN SSO (commits 822c66a, 5a9e3d4):
- ปัญหา: localStorage แยกต่อ origin — token เก็บใน viiv.me
  ไม่ถ่ายทอดไป {subdomain}.viiv.me → superboard เห็นว่าไม่มี token →
  redirect กลับ login → loop
- frontend/login.html goShop(): เพิ่ม ?token=encodeURIComponent(t)
  ต่อท้าย URL ก่อน redirect
- frontend/superboard/index.html: เพิ่ม IIFE ที่ต้น <script>
  อ่าน URLSearchParams.get('token') → setItem('viiv_token')
  history.replaceState ลบ token ออกจาก URL bar (กัน leak)
- frontend/superboard/index.html: เพิ่ม <meta name="referrer"
  content="no-referrer"> ใน <head> — กัน Referer leak token
  (assets ที่โหลดก่อน replaceState ทำงานไม่เห็น token แล้ว)

DEVICE-AWARE REDIRECT (commit 9a9e1f9):
- frontend/login.html goShop(): detect via navigator.userAgent
  /iPhone|iPad|iPod|Android/i → path = /pwa/
  อื่นๆ (desktop) → path = /superboard/
- frontend/pwa/js/auth.js: เพิ่ม SSO IIFE pattern เดียวกับ superboard
  — รองรับ /pwa/?token=... → setItem 'viiv_token' + replaceState

FLOW ENDPOINT-TO-ENDPOINT:
1. user เปิด viiv.me/login.html → ใส่ email/pass
2. POST /api/platform/login → {access_token, shops:[{subdomain,...}]}
3. localStorage(viiv.me).platform_token = token
4. shops.length===1 → goShop(subdomain)
5. detect mobile → /pwa/ | desktop → /superboard/
6. redirect → https://{subdomain}.viiv.me{path}/?token=XXX
7. SSO IIFE รับ token → setItem 'viiv_token' (key ของ shop ecosystem)
8. history.replaceState → URL = {path}/#home (token หาย)
9. main app boot — getToken() อ่าน localStorage(subdomain) เจอ token

SECURITY HARDENING:
- replaceState ลบ token จาก URL bar (กัน history/bookmark leak)
- <meta name="referrer" content="no-referrer"> ใน superboard/index.html
  ห้ามส่ง Referer header (กัน CDN/3rd party รู้ token)
- encodeURIComponent กัน special chars (=,+,/) ใน token
- ความเสี่ยงที่ยังเหลือ (tech debt):
  * Caddy access log อาจ log ?token=... ก่อน replaceState ทำงาน
  * localStorage เปิดให้ XSS อ่านได้ — ระยะยาวควรย้ายเป็น HttpOnly cookie
    scope .viiv.me

COMMITS (6 commits, branch main):
  60220cb  fix: PWA redirect to viiv.me/login
  34a6c22  fix: PWA redirect viiv.me/login + auto hash home
  84455a3  fix: login.html redirect to shop subdomain after login
  822c66a  fix: cross-origin SSO — pass token via URL param to subdomain
  5a9e3d4  fix: no-referrer meta — prevent token leak in referer header
  9a9e1f9  fix: login goShop detect mobile → /pwa/ or /superboard/

FILES CHANGED:
  frontend/login.html               (endpoint /api/platform/login,
                                     token key platform_token,
                                     shops-based redirect, shopPicker UI,
                                     goShop device detect + token URL param)
  frontend/pwa/js/auth.js           (redirect viiv.me/login.html ทั้ง 3 จุด,
                                     SSO IIFE รับ token จาก URL param)
  frontend/pwa/index.html           (early redirect → /pwa/#home, asset bump)
  frontend/superboard/index.html    (SSO IIFE token receiver,
                                     <meta name="referrer" no-referrer>)

Version: v1.59 | Updated: 2026-04-30


## [J] EOD 2026-04-30 — Auth/Identity Rename + Switch-Shop + Dashboard Cards

SUMMARY
- Rename DB table platform_users → viiv_accounts (FK refs preserved)
- Rename frontend file platform/login.html → platform/signin.html (8 ลิงก์)
- viiv.me/login.html: /api/platform/login → /api/staff/login (เดิมผิดตาราง)
- Switch Shop dropdown + Join Shop popup (PC superboard + PWA mobile)
- POS Dashboard + Affiliate cards แสดงข้อมูลจริง (PC + PWA)
- register_shop provision viiv_accounts + tenant_staff + tenants.owner_id
- /my-shops, /join-shop, _admin_auth, _decode_user รองรับ JWT 2 shapes
- POS Affiliate tab CSS + LINE webhook URL ตาม subdomain
- Caddyfile: 3 patches (viiv.me api port, signin redirect, /merchant/* handler)

KEY FIXES (theme groups)

1. AUTH/IDENTITY RENAME
   - DB: ALTER TABLE platform_users RENAME TO viiv_accounts
   - Code refs: app/api/login.py, app/api/platform_connections.py
   - File rename: frontend/platform/login.html → signin.html
   - URL refs: superboard/js/core/auth.js, platform/{dashboard.html,
     pages/settings.html, js/core/auth.js} (incl. pathname.includes guard)

2. PWA LOGIN ENDPOINT
   - viiv.me/login.html: เปลี่ยน fetch /api/platform/login → /api/staff/login
   - /api/staff/login response: เพิ่ม subdomain + store_name (single + multi-shop)
   - Multi-shop: cache email/pass in memory แล้ว re-POST + tenant_id
   - Caddy viiv.me block: /api/* port 9000 → 8000 + handle (ไม่ใช่ handle_path)

3. SWITCH SHOP / JOIN SHOP (PC + PWA)
   - Backend: POST /api/platform/join-shop, DELETE /api/platform/my-shops/{tid}
   - Dropdown ใน topbar (revert full-page approach)
   - คลิกร้าน → /join-shop + redirect subdomain
   - "+ เพิ่มสาขา" → popup overlay เล็ก (ไม่ใช่ inline form)
   - Save → ปิด popup + refresh dropdown + toast (ไม่ redirect)
   - Input strip: /^https?:\/\// + /\.viiv\.me.*$/ + /\/.*$/ → subdomain ล้วน
   - PC popup: addEventListener (เลี่ยง onclick attribute), id-based bindings
   - getToken() fallback: viiv_token → platform_token

4. DASHBOARD CARDS (POS + AFFILIATE)
   - GET /api/pos/dashboard/summary: orders_today, revenue_month, orders_month,
     staff_online (count tenant_staff last_seen ภายใน 60 นาที)
   - GET /api/pos/affiliate/summary: clicks_today/month, commission_month
     (JOIN affiliate_products), commission_rate (AVG percent active)
   - PC superboard/dashboard/app.js: parallel /summary fetch + renderAff()
   - PWA pwa/pages/home.js: Promise.allSettled + Staff Online แทน "สต็อกใกล้หมด"

5. AUTH PERMISSIVENESS
   - _admin_auth: รับ {user_id, email} เพิ่ม (เดิม tenant_id|sub|admin role เท่านั้น)
     → connections page ไม่เด้ง login สำหรับ token เก่า
   - _decode_user: 3-step lookup
     1) tenant_staff WHERE id=sub             (staff-login token)
     2) tenant_staff WHERE email=jwt.email    (platform-login + provisioned)
     3) viiv_accounts WHERE id=sub             (fallback SimpleNamespace adapter)
   - /api/platform/login: เพิ่ม sub field ใน token_payload (JWT convention)
   - /api/platform/my-shops: ถ้า JWT ไม่มี email → ดึงจาก tenant_staff
     หา owner_uid (pfu) จาก viiv_accounts WHERE email
     → ใช้งานได้ทั้ง platform-login (sub=pfu) + staff-login (sub=stf)

6. REGISTER SHOP PROVISION
   - register_shop เดิมสร้างเฉพาะ users + tenants → login ทั้ง 2 endpoint หาไม่เจอ
   - แก้: หลัง create_tenant เพิ่ม 3 ขั้นในทรานแซคชันเดียว
     1) INSERT viiv_accounts (id=pfu_*, email, hashed_pw) ON CONFLICT update
     2) UPDATE tenants SET owner_id = viiv_accounts.id
     3) INSERT tenant_staff (role='owner', user_id=link, hashed_pw เดียวกัน)
   - bcrypt hash portable ระหว่าง 3 tables
   - Backfill: bbb@gmail.com (ten_37f95526) จาก users → viiv_accounts + tenant_staff

7. POS AFFILIATE TAB + LINE WEBHOOK
   - Affiliate tab: viiv-subtab (sub size) → pos-tab (main size) + inline style
     (ไม่พึ่ง global.css เผื่อโหลดไม่ได้บาง path)
   - LINE webhook URL: hardcoded 'https://concore.viiv.me/api/line/webhook' →
     window.location.origin + ?tenant=jwt.tenant_id (เหมือน PWA pages/line.js)
   - dashboard.html token guard redirect: /platform/login.html (broken) →
     https://viiv.me/login (shop login)
   - Caddy *.viiv.me: เพิ่ม handle /merchant/* → /modules/pos/merchant/ui/dashboard
     (เดิม fallback เสิร์ฟ /superboard/index.html เป็น CSS → parse ไม่ได้)

8. PLATFORM CONNECTIONS QR URL
   - Bug: รูป QR ซ้อน base URL 2 ชั้น —
     'https://concore.viiv.me' + 'https://viiv.me/platform/uploads/...'
   - Fix: absUrl() helper — full URL ใช้ตรงๆ, relative → prepend viiv.me

CADDYFILE CHANGES (/etc/caddy/Caddyfile)
- viiv.me block:        handle_path /api/* + localhost:9000
                          → handle /api/* + localhost:8000
- concore.viiv.me block: redir / /platform/login.html
                          → redir / /platform/signin.html
- *.viiv.me block:      เพิ่ม handle /merchant/* {
                            root * /home/viivadmin/viiv/modules/pos/merchant/ui/dashboard
                            uri strip_prefix /merchant
                            file_server
                          }
- Backups: /etc/caddy/Caddyfile.bak.20260430_080656 ฯลฯ

DATABASE CHANGES
- ALTER TABLE platform_users RENAME TO viiv_accounts (FK refs preserved)
- Backfill bbb@gmail.com: viiv_accounts (pfu_23210ef3) + tenant_staff (stf_*) +
  tenants.owner_id ของ ten_37f95526 (test8)

COMMITS (24 commits, branch main, ในเซสชันวันนี้)
  2a00cca  fix: PWA mobile login endpoint + auth flow (rename + endpoint)
  02157aa  fix: Caddyfile viiv.me api proxy port 9000→8000 + signin.html redirect
  4975d4b  feat: POST /api/platform/join-shop + DELETE /api/platform/my-shops/{tid}
  fce8be3  feat(superboard): switch shop full page + popup     [later reverted]
  dcb655e  feat(pwa): switch shop full page + popup            [later reverted]
  668d9ee  feat: GET /api/pos/dashboard/summary + /api/pos/affiliate/summary
  f3a0622  feat(superboard dashboard): POS + Affiliate cards ใช้ /summary
  9a3346d  feat(pwa home): POS + Affiliate cards ใช้ /summary
  feb2f1c  chore: remove AI_MODE.txt (user)
  523c9e0  feat: Switch Shop dropdown + small popup (revert full page)
  35941dc  fix(pos affiliate): tab CSS class viiv-subtab → pos-tab
  da01279  fix(pos affiliate): tab inline style ไม่พึ่ง global.css
  2ea576e  fix: Caddy add /merchant/* handler for global CSS
  8ab758e  fix(pos line): webhook URL ตาม subdomain + login redirect
  d31b1a7  fix(platform login): เพิ่ม sub ใน JWT payload
  d39e16d  fix(_admin_auth): รับ user_id + email ด้วย
  a7dfd7c  fix(platform connections): QR URL ซ้อน base URL 2 ชั้น
  c146f84  fix(register_shop): provision viiv_accounts + tenant_staff + owner_id
  5ffe515  feat(switch-shop): refresh dropdown on open + join-shop ไม่ redirect
  4800283  fix(_decode_user): รองรับ platform-login token (sub=pfu_xxx)
  fa74ca5  fix(switch-shop): bulletproof saveShopAdd + saveAdd
  5d2fd3c  fix(switch-shop): popup ใช้ addEventListener + token fallback
  1413b70  fix(switch-shop): loadShopList diagnostic + force dropdown open
  6a8f4d9  fix(my-shops): รองรับ staff-login JWT (sub=stf_xxx, ไม่มี email)

FILES TOUCHED (major)
  Backend (Python):
    app/api/login.py                        (sub field, signin support)
    app/api/platform_connections.py         (rename, _admin_auth, _decode_user,
                                             /join-shop, /my-shops, /remove)
    app/api/pos_affiliate.py                (/summary endpoint)
    app/api/pos_dashboard.py    [NEW]       (/summary endpoint)
    app/api/register_shop.py                (provision viiv_accounts + tenant_staff)
    app/main.py                             (register pos_dashboard router)

  Frontend (PC superboard):
    frontend/superboard/index.html          (dropdown + popup + addEventListener)
    frontend/superboard/js/core/auth.js     (signin.html links)
    frontend/superboard/dashboard/app.js    (parallel /summary, renderAff)
    frontend/superboard/dashboard/index.html (Affiliate KPI ids)

  Frontend (PWA):
    frontend/pwa/index.html                 (dropdown + popup HTML)
    frontend/pwa/js/app.js                  (ShopSwitcher revamp)
    frontend/pwa/css/app.css                (popup CSS + restore dropdown)
    frontend/pwa/pages/home.js              (3-endpoint Promise.allSettled)

  Frontend (Platform admin):
    frontend/platform/signin.html           (renamed from login.html)
    frontend/platform/dashboard.html        (signin.html refs, isLoginPage)
    frontend/platform/js/core/auth.js       (LOGIN_PATH, isLoginPage)
    frontend/platform/pages/connections.html (QR URL absUrl helper)
    frontend/platform/pages/settings.html   (signin.html ref)

  Frontend (entry):
    frontend/login.html                     (/api/staff/login + multi-shop flow)

  Modules (POS merchant iframe):
    modules/pos/merchant/ui/dashboard/dashboard.html       (token guard redirect)
    modules/pos/merchant/ui/dashboard/affiliate/all.html   (pos-tab class+inline)
    modules/pos/merchant/ui/dashboard/connections/main.html (webhook URL helper)
    modules/pos/merchant/ui/dashboard/settings/store.html  (webhook URL helper)

KNOWN STATE / INVARIANTS
- staff-login JWT (sub=stf_xxx, ไม่มี email) ใช้ใน viiv_token บน shop subdomain
- platform-login JWT (sub=pfu_xxx, มี email) ใช้ใน platform_token บน viiv.me /
  concore.viiv.me (ปัจจุบัน /api/platform/login เพิ่ม sub field ใน payload ด้วย)
- /api/platform/* endpoints: รองรับทั้ง 2 token shapes ครบ
- register_shop: สร้าง 3 tables ครบ (users [legacy] + viiv_accounts +
  tenant_staff + tenants.owner_id linked) → login ได้ทั้ง 2 endpoint
- ทุก reference ในโค้ด/HTML ของ /platform/login.html → /platform/signin.html
- POS PC iframe โหลด /merchant/global.css จาก shop subdomain ได้แล้ว

PENDING / FOLLOW-UP
- access_token return จาก /join-shop = staff-login shape (sub=stf, ไม่มี email)
  → ถ้าจะใช้เปลี่ยน "ร้านปัจจุบัน" บน topbar ต้อง replace viiv_token ใน
  localStorage ด้วย — ปัจจุบันยังไม่ทำ (เก็บ token เดิมไว้, /my-shops ใช้ได้
  ผ่าน fallback resolve email จาก tenant_staff)
- Caddyfile อยู่นอก repo (/etc/caddy/) — markers via empty commits เก็บใน git history
- AI_MODE.txt ลบแล้ว (user); AI_RULES.md เก็บไว้

Version: v1.60 | Updated: 2026-04-30 (EOD)


### [J.1] POST-EOD ADDENDUM 2026-04-30 — PWA polish + Caddy /pwa redir

ADDITIONAL FIXES (4 commits หลัง EOD doc)

1. PWA URL ROUTING (Caddy)
   - Bug: พิมพ์ test7.viiv.me/pwa (ไม่มี slash) → ตกที่ catch-all → serve
     /superboard/index.html (ผู้ใช้เห็น superboard แทน PWA)
   - Caddy *.viiv.me block: เพิ่ม `redir /pwa /pwa/ 308` ก่อน
     `handle /pwa/* {...}` — กลับมา /pwa/ ที่ตรง handler
   - Backup: /etc/caddy/Caddyfile.bak.20260430_1500ish

2. PWA HOME DEFENSIVE
   - Bug: หน้า home โหลดได้ topbar+navbar แต่ #page-container ว่าง
   - _reload(): try/catch แยก
       • Promise.allSettled fetch wrapper — silent catch
       • _html(data) render — ถ้า throw แสดง error UI + ปุ่ม "ลองใหม่"
         (เดิม throw แล้ว skeleton ค้าง / blank)
       • _startTickers/_startClock/_loadPlatformStatus แยก try/catch
         ถ้า 1 ตัวพัง 2 ตัวที่เหลือยังทำงาน

3. DEBUG CLEANUP
   - ลบ console.log/warn/error 24 จุดที่เพิ่มตอน debug switch-shop:
       • superboard/index.html: [shop popup], [saveShopAdd], [loadShopList]
       • pwa/pages/home.js: [home._reload] + [home] tickers/clock/platform
       • pwa/js/app.js: [ShopSwitcher.saveAdd]
   - เก็บ try/catch defensive ทั้งหมด — เปลี่ยน catch body จาก
     console.error เป็น silent
   - เก็บ error UI fallback ใน home.js _html() catch (มี user value)

4. PWA META TAG (Android compatibility)
   - เพิ่ม <meta name="mobile-web-app-capable" content="yes"> ใน
     superboard/index.html ก่อน apple-mobile-web-app-capable
     (deprecation warning จาก Chrome/Android — ต้องคู่กัน)
   - PWA index.html มีทั้งคู่อยู่แล้ว

COMMITS (4 commits, branch main, post-EOD)
  a05f6a4  fix: Caddy redir /pwa → /pwa/ 308 for mobile PWA (user)
  b382f18  fix(pwa home): try/catch รอบ _html — ป้องกันหน้าว่างเงียบ
  ede05cd  chore: remove debug console.log จาก switch-shop + home.js
  eea772d  fix: เพิ่ม mobile-web-app-capable meta — รองรับ Android

FILES TOUCHED
  Caddy:      /etc/caddy/Caddyfile (+redir /pwa /pwa/ 308 ใน *.viiv.me)
  Frontend:   frontend/pwa/pages/home.js     (defensive try/catch + render error UI)
              frontend/pwa/js/app.js          (debug cleanup)
              frontend/superboard/index.html  (debug cleanup + meta tag)

Version: v1.60.1 | Updated: 2026-04-30 (post-EOD)


---

## [J] EOD 2026-05-01 — Subscription System (7 Phases) + Topbar Lockdown + Deploy Tooling

SUMMARY
- Subscription Management Platform ครบ 7 phases (DB → Backend → LINE notify
  → Scheduler → Middleware → UI → Soft-block 402 handler)
- Manual subscription editor modal + backfill trial dates (admin tools)
- LINE webhook activate tenant ผ่านอีเมล (platform OA `@004krtts`)
- Topbar height lockdown (Superboard) — แก้ผ่าน 13 commits ทดลองหลายชั้น
  จนสุดท้ายย้าย dropdowns ออกนอก header + lock height ทุกระดับ
- Bug fixes: viiv.me login URL, register phone CSS, reload hash restore,
  shop switcher ellipsis + dropdown polish
- Deploy tooling: deploy.sh + rollback.sh พร้อม health-check + auto-revert

KEY DECISIONS / DESIGN
1. Subscription
   - billing_status: trial / active / suspended / cancelled
   - 5 LINE templates (trial_warning, trial_expiry, expiry_warning_3d/_1d, overdue)
   - Schedule day-exact picker (cron 09:00 Asia/Bangkok)
     trial: d=2 / d=0; active: d=3 / d=1; overdue: d=-2/-4/-6
   - Suspension rule: trial<0 OR active overdue ≥7d
   - Two safety flags (default ON for safe rollout):
     BILLING_SCHEDULER_DRY_RUN=1 — log + DB log only, ไม่ส่ง LINE
     BILLING_GUARD_MODE=report  — log + header X-Billing-Suspended:1, pass through
   - Pricing matrix 3×3: pkg_basic/standard/pro × pos+affiliate / +chat / +chat+autopost
     299/599/899 / 599/1198/1797 / 899/1798/2697 (THB / month)

2. Soft-block 402
   - middleware whitelist: /api/staff/login|heartbeat|presence,
     /api/platform/*, /api/line/*, /api/health, all non-/api paths
   - 60s TTL cache for tenant billing_status; clear_billing_cache()
     called inside /confirm-payment for instant un-suspension
   - PWA banner top-fixed + html.billing-blocked dim primary buttons
   - Superboard fullscreen modal + body.billing-blocked iframe blur
   - both surfaces detect 402 via window.fetch monkey-patch (idempotent)

3. Topbar architecture (final)
   - <header> overflow:hidden!important + height/min/max:50px!important
   - dropdowns moved OUT of <header>, position:fixed top:50px
     z-index:1000; click handler ตรวจ #shopDropdown / #profileDropdown /
     #bellDropdown ด้วย (ไม่ใช่แค่ wrap parent)
   - .sb-topnav-btn: height/min/max:32px + line-height:1 (no font-metric drift)
   - #tab-platforms: 40px lock (ใน dashboard iframe — ไม่ใช่ outer topbar)

4. Tooling
   - deploy.sh: git pull → pip install → restart uvicorn :8000 → health ×3
     → ถ้า fail: git revert HEAD --no-edit → restart → health ×3 → ถ้ายัง
     fail: exit 2 (manual)
   - rollback.sh: git revert <commit>..HEAD --no-edit (ไม่ใช่ checkout =
     ไม่ detached HEAD) → restart → health ×3
   - health URL: https://concore.viiv.me/api/platform/health (no auth)
   - logs/ + *.log อยู่ใน .gitignore (logs/uvicorn.log ตามเดิมเพราะ track
     ก่อน .gitignore — ไม่บล็อก pull/push, optional rm --cached ในรอบหน้า)

DB CHANGES
- ALTER tenants: trial_ends_at timestamptz, subscription_ends_at timestamptz,
  billing_status text default 'trial', modules text[] default '{pos,affiliate}',
  line_uid text
- NEW: billing_invoices, billing_notifications, billing_prices (9 rows)
- ALTER platform_connections: ADD CONSTRAINT UNIQUE (platform); cleanup
  duplicate rows of platform='line'; populate channel_token + channel_secret
- Backfill: trial_ends_at = created_at + 30 days WHERE NULL (8 tenants)
- All ALTERs run via supabase_admin (postgres user lacks ownership of
  tenants/viiv_accounts); platform_connections owned by postgres OK

API ADDITIONS
- GET  /api/platform/overview                   — real data (8 tenants etc.)
- POST /api/platform/cache/clear-subdomain/{sub}— invalidate after subdomain edit
- GET  /api/platform/logs?lines=N               — admin log tail (cap 500)
- POST /api/line/webhook/platform               — platform-OA webhook (path
                                                  separate from per-shop /webhook)
- GET  /api/platform/billing/subscriptions      — list + days_remaining + amount_due
- POST /api/platform/billing/confirm-payment    — INSERT invoice + UPDATE tenant
                                                  + cache invalidate + LINE thanks
- GET  /api/platform/billing/prices             — 9-row pricing matrix
- POST /api/platform/billing/notify/{tid}       — manual reminder (?type= override,
                                                  ?dry_run=true preview)
- POST /api/platform/billing/run-check          — admin trigger scheduler
- GET  /api/platform/billing/invoices           — history
- GET  /api/platform/billing/notifications      — history
- PATCH /api/platform/billing/subscriptions/{tid}— manual edit fields

CADDY
- /logs/* — replaced { file_server } with { respond 404 } (no public log dump)
- /api/line/webhook/platform — handled by *.viiv.me block? — NO: webhook
  is on concore.viiv.me/api/line/* → goes via concore /api proxy

FILES TOUCHED (major)
  Backend:
    app/api/platform_connections.py  (overview + cache + logs + my-shops logo)
    app/api/billing.py               [NEW] (10 endpoints)
    app/api/pos_line.py              (+/webhook/platform endpoint)
    app/scheduler/billing_scheduler.py  [NEW] (APScheduler 09:00 daily)
    app/middleware/billing_guard.py     [NEW] (60s cache + 3 modes)
    app/main.py                      (register middleware/scheduler hooks)

  Frontend:
    frontend/platform/pages/billing.html  [NEW] (3 tabs + 2 modals)
    frontend/platform/dashboard.html      (sidebar 💰 expandable + reload hash)
    frontend/superboard/index.html        (dropdowns out of header,
                                           sbNav set hash, fetch wrapper 402)
    frontend/superboard/css/theme.css     (topbar lockdown, shop-btn,
                                           dropdown position:fixed)
    frontend/superboard/dashboard/style.css (#tab-platforms 40px lock)
    frontend/pwa/index.html               (billing banner, hash reload)
    frontend/pwa/js/app.js                (BillingBlock fetch interceptor,
                                           ShopSwitcher logo + observability)
    frontend/pwa/css/app.css              (topbar lock, shop-dropdown polish)
    frontend/pwa/pages/register-shop.html (phone tel CSS + result above submit)
    frontend/register.html                (login href, phone CSS scoped)
    frontend/index.html                   (login href fix)

  Tooling:
    deploy.sh   [NEW]
    rollback.sh [NEW]

  Docs:
    CLAUDE.md            (+DB rules Green dev, +deploy/rollback usage)
    .gitignore           (logs/ + *.log already present, verified)
    Caddyfile (out of repo, in /etc/caddy/) (3 patches across day)

COMMITS (~95 commits pushed origin/main today, latest e8d907c)
  Notable groups:
    - Subscription Phase 1-7: Phase 1 (SQL), a888022, 2f76538, a4d3c5a,
      4cc0621, ca4d58f, 715d0bc
    - Backfill + editor modal: c9538e7
    - Sidebar restructure: 557138c (billing under บัญชีการเงิน)
    - 3-bugs fix: 1cc3b08 (login + register phone + reload hash)
    - PWA shop switcher polish: 10dee1f → 5479afe → 504fc4f
    - Topbar lockdown saga: c436ae1 → b2cae10 → c0bfba5 → 19f90b8 → 7187210
      → 334595a → 96500cd → 701c34a → 4633360 → 27cccad → b2e87b0 → a27af9a
      → 2139a42 (13 iterations — final solution: dropdowns out of header)
    - Shop switch debug: 66d5f09 (silent-fail observability) + 1ce89e9
      (overflow:hidden ตัด dropdown)
    - Tooling: 707ebda (scripts) + f3c9fdb (review fixes) + 6de635b/e8d907c (docs)

KNOWN STATE / INVARIANTS (อ่านก่อนต่องานพรุ่งนี้)
- Production = origin/main = commit e8d907c (auto-deployed via ./deploy.sh)
- BILLING_SCHEDULER_DRY_RUN=1 (default) — เปลี่ยน 0 เพื่อส่ง LINE จริง
- BILLING_GUARD_MODE=report (default) — เปลี่ยน enforce เพื่อ block 402
- ten_1 trial_ends_at = 2026-05-11 (10 days), 8 tenants pending = 8-30 days
- LINE platform OA credentials populated in platform_connections
  WHERE platform='line' (channel_token/_secret/oa_id)
- middleware order (Starlette `insert(0)`): rate_limiter → billing_guard
  → inject_tenant → ... → handler
- shop dropdowns in Superboard: position:fixed top:50px outside <header>


---

## [J] EOD 2026-05-01 (Part 2) — Chat Dashboard Refactor + AI Manager + Log Untracking

SUMMARY
- modulechat dashboard UI พลิกใหม่: ลบ topbar, ย้าย tabs เข้า panel-left,
  เพิ่ม platform logos row (LINE/FB/TikTok/IG/YouTube) เป็น filter,
  fix layout/styles ให้เข้ากับ Superboard theme
- Platform AI Manager เต็มฟีเจอร์: backend `app/api/platform_ai.py`
  (sync SQLAlchemy, _admin_auth header) + frontend `pages/ai.html`
  (4 stats / API keys / models / by-model chart / tenant credits / token flow log)
- DB ใหม่ 3 tables: `ai_api_keys`, `ai_token_log`, `ai_tenant_credits`
  (option 3: แยก credits ออกจาก tenants เพราะ tenants owner = supabase_admin)
- Logs untrack ออกจาก git แท้ (`logs/uvicorn.log`) — รอบแรก `git add -A`
  re-stage ทันทีหลัง `git rm --cached`, ต้อง commit แบบไม่ผ่าน add -A
- Deploy ทดสอบจริง: deploy.sh restart Blue :8000 + health×3 ผ่าน

RULES ADDED
103  modules/chat webhook gate = X-Forwarded-From: viiv-internal
104  LINE webhook ทั้ง 2 routes forward ไป :8003 แบบ fire-and-forget
105  platform_connections เพิ่ม column channel_id
106  chat module รัน: `python -m uvicorn modules.chat.main:app --port 8003`
107  chat_conversations เพิ่ม columns: unread_count + bot_enabled
108  chat_bot_settings สร้าง auto ตอน GET /chat/bot/settings ครั้งแรก
109  Chat Dashboard path: /modulechat/ui/dashboard/index.html
110  modUrls.chat = /modulechat/ui/dashboard/index.html
111  ai_api_keys + ai_token_log + ai_tenant_credits tables (2026-05-01)
112  platform_ai_router prefix="/api/platform" → /api/platform/ai/*
113  logs/ ทั้งหมดอยู่ใน .gitignore — ห้าม track ไฟล์ใต้ logs/ ลง git
114  deploy.sh = restart Blue :8000 + health×3 + auto `git revert HEAD` ถ้าพัง

KEY DECISIONS / DESIGN
1. Chat dashboard structure
   - body เป็น flex-row เต็มจอ (no topbar)
   - panel-left: panel-head (title + online badge) → tab-row (Inbox/Bot/Stats)
     → search box → platform-row (5 SVG logos) → conv-list
   - tabs control panel-right content; panel-left always visible (desktop)
   - mobile: panel-left.hidden เมื่อเปิด conv (ไม่ใช่ has-active บน main เก่า)

2. AI Manager backend adapt to codebase
   - spec ต้นฉบับใช้ async + Depends(get_db)/get_platform_user
   - codebase pattern = sync `engine.connect()`/`engine.begin()` + Header auth
   - _admin_auth() เลียน platform_connections.py — permissive JWT decode
   - by_tenant query ต้องเพิ่ม `t.id AS tenant_id` เพราะ frontend PATCH
     /credit/{tenant_id} ต้องใช้ id จริง (subdomain ไม่พอ)

3. Tenants ownership constraint
   - postgres role ไม่ใช่ owner ของ tenants (= supabase_admin)
   - ALTER TABLE tenants ADD COLUMN ai_credit_* → ERROR must be owner
   - แก้: สร้าง `ai_tenant_credits` table ใหม่ (PK tenant_id FK → tenants.id)
   - LEFT JOIN + COALESCE(0) ในทุก query / UPSERT ใน PATCH

4. Log untrack pitfall
   - `.gitignore` รับ `logs/` + `*.log` อยู่แล้ว แต่ logs/uvicorn.log ยัง tracked
   - `git rm --cached <file> && git add -A` = no-op เพราะ add -A ดู file
     เป็น modification ของ tracked file (gitignore ใช้กับ untracked เท่านั้น)
   - แก้: `git rm --cached <file>` แล้ว `git commit` ตรงๆ ไม่ผ่าน add -A

FILES TOUCHED (major)
  Backend:
    app/api/platform_ai.py            [NEW] (7 endpoints)
    app/main.py                       (register platform_ai_router)
  Frontend:
    frontend/platform/pages/ai.html   (overwrite — full AI manager UI)
    modulechat/ui/dashboard/index.html (no-topbar refactor)
    modulechat/ui/dashboard/chat.css  (new layout + platform-row styles)
    modulechat/ui/dashboard/chat-ui.js (renderPlatformLogos + togglePlatform)
  DB:
    ai_api_keys, ai_token_log, ai_tenant_credits  [NEW tables, idempotent]
  Tooling/Misc:
    .gitignore                        (logs/uvicorn*.log + logs/chat.log lines)
    logs/uvicorn.log                  (untracked)

COMMITS (chronological)
  e1a1c31  fix: chat dashboard no-topbar + platform logos + API base URL fix
  e1266f5  feat: AI manager page (keys/models/token-flow/credits)
  657d9cf  feat: AI manager page + platform_ai router + chat dashboard UI
  ca25a67  chore: untrack log files from git  (← incomplete — see 774b755)
  774b755  chore: actually untrack logs/uvicorn.log

🔴 NEXT UP
1. ทดสอบ Add เพื่อน LINE OA จริง → ดู conversation ปรากฏใน Chat Dashboard
2. Message handler — รับข้อความธรรมดา (ปัจจุบันรับแค่ follow event)
3. AI Manager page — ทดสอบ keys + token flow ใน browser ว่าทุกการ์ดโหลด
4. True Blue/Green :9000 (deploy.sh ปัจจุบันยัง Blue-only restart)

---

## [K] TOOLING & OPS (2026-05-01)

> Version: v3.0 | Updated: 2026-05-01 | Git Latest: 774b755

GIT RESTORE POINTS
- 774b755 — chore: untrack log files
- 657d9cf — feat: AI manager + platform_ai router + chat dashboard UI
- 34c74eb — feat: chat API endpoints
- 63b54e0 — feat: superboard switchMod chat
- 1322b34 — feat: modules/chat LINE webhook Phase 1

DEPLOY
```bash
cd /home/viivadmin/viiv && ./deploy.sh
```
Pipeline: git pull origin main → pip install -q → restart uvicorn :8000
→ wait 5s → health check ×3 every 3s on /api/platform/health
→ pass: ✅ Deploy สำเร็จ; fail: auto git revert HEAD --no-edit + restart
+ recheck; double-fail: exit 2 (manual)

ROLLBACK
```bash
./rollback.sh                # revert 1 commit (HEAD~1..HEAD)
./rollback.sh <commit-hash>  # revert all commits AFTER <hash>
```
Uses `git revert <target>..HEAD --no-edit` — keeps branch on main, no
detached HEAD. health-check ×3 same as deploy.

GREEN-DEV DB RULES (CLAUDE.md)
- Green port 9000 shares DB with Blue
- ✅ CREATE TABLE chat_* / autopost_* only; INSERT/UPDATE/SELECT in those
- ✅ SELECT (read-only) on legacy tables
- ❌ DROP / TRUNCATE / ALTER COLUMN / RENAME on any legacy table
- ❌ INSERT / UPDATE / DELETE on bills, members, tenants, products,
   tenant_staff, viiv_accounts, etc.

ENV FLAGS (uvicorn)
- BILLING_SCHEDULER_ENABLED=1   start cron job at boot (default 1)
- BILLING_SCHEDULER_DRY_RUN=1   preview only (default 1 — flip to 0 to send)
- BILLING_GUARD_MODE=report     log only (default report; enforce|off)
- BILLING_GUARD_ENFORCE not used — value is BILLING_GUARD_MODE

HEALTH CHECK
- Public:  GET https://concore.viiv.me/api/platform/health
- Returns: {"status":"ok","version":"1.54"}

ADMIN MANUAL TRIGGER
- POST /api/platform/billing/run-check       (scheduler one-shot)
- POST /api/platform/billing/notify/{tid}?type=trial_warning&dry_run=true

SHARED LIB DEPS ADDED 2026-05-01
- apscheduler 3.11.2 (BackgroundScheduler, CronTrigger, Asia/Bangkok)
- requests 2.32.5 (already installed; used in LINE push)

KNOWN ISSUES / TECH DEBT

TD-CADDY-DUPE (logged 2026-05-07): dev7 + test7 blocks มี `handle /chat/*` ซ้ำ 2 ครั้ง

สถานะปัจจุบัน:
  test7 block:
    handle /chat/* { reverse_proxy localhost:8003 }  ← ใช้งาน (first match)
    handle /chat/* { reverse_proxy localhost:9000 }  ← dead code

  dev7 block:
    handle /chat/* { reverse_proxy localhost:8003 }  ← ใช้งาน (first match)
    handle /chat/* { reverse_proxy localhost:8000 }  ← dead code

ผลกระทบปัจจุบัน: ไม่มี (first-match wins)

ผลกระทบในอนาคต — Landmine ที่ต้องระวัง:
1. ถ้ารัน cutover.sh ครั้งแรก → sed regex จะ swap port ใน duplicate ที่ 2 ด้วย
   → Caddyfile messy ขึ้น แต่ functional ยังถูก
2. ถ้าวันหนึ่งใครลบ duplicate ที่ 1 (โดยไม่รู้ context) → ตัวที่ 2 จะ active ทันที
   → /chat/* บน dev7/test7 จะชี้ผิด port → chat module พังเงียบๆ

Action ที่ต้องทำก่อน cutover.sh ใช้จริงครั้งแรก:
- ลบ `handle /chat/* { reverse_proxy localhost:9000 }` ออกจาก test7 block
- ลบ `handle /chat/* { reverse_proxy localhost:8000 }` ออกจาก dev7 block
- validate + reload Caddy
- backup Caddyfile ก่อน

Priority: ก่อน cutover ครั้งแรก (ยังไม่ต้องรีบเดี๋ยวนี้)

Version: v1.61 | Updated: 2026-05-01 (EOD)

---

## [J] EOD 2026-05-04 — LINE webhook media handling (Phases 1+3 complete)

SUMMARY
- Phase 1: webhook (per-tenant + platform OA) เก็บ message_type + raw_event.message_id
  ครบ 7 ชนิด (text/image/sticker/video/audio/file/location); AI/bot reply gate
  เฉพาะ msg_type=='text' กัน AI ตอบมั่วบน non-text + ประหยัด token
- Phase 3: background download media (image/video/audio/file) จาก
  api-data.line.me/v2/bot/message/{id}/content → save under
  /uploads/line/{tenant}/{conv}/{message_id}.{ext} → patch chat_messages.raw_event
  ด้วย media_url + media_size; chat-ui.js render <img>/<video>/<audio>/<a> ใน bubble
- Bug fix (5db7fff): SQL `:url::text` ขัดกับ SQLAlchemy text() parameter parser
  → เปลี่ยนเป็น `CAST(:url AS text)` (Rule 192). Back-fill 3 row (id 106-108) manual

NEW FILES
- app/api/line_content.py        — sync (requests + threading) สำหรับ pos_line.py
- modules/chat/line_content.py   — async (httpx + asyncio.create_task) สำหรับ
                                   modules/chat/line_webhook.py (คนละ Python package
                                   จาก app/ → ใช้ `from .db import AsyncSessionLocal`)

MODIFIED
- app/api/pos_line.py            — msg type dispatch + spawn_download
- modules/chat/line_webhook.py   — msg type dispatch + spawn_download +
                                   save_message extended (msg_type param)
- modules/chat/chat_api.py       — GET /chat/conversations/{id}/messages เพิ่ม
                                   media_url field ใน response
- modulechat/ui/dashboard/chat-ui.js — _renderMsgInner() helper render media;
                                   smart-render fingerprint (id+media_url) แทน
                                   count-only (เพื่อให้ media ที่โหลดเสร็จหลัง
                                   webhook insert ขึ้นรูปทันทีไม่ต้องรอ msg ใหม่)

RULES ADDED (177-193)
Rule 177 — LINE webhook handle msg.type ครบ 7 ชนิด:
           text/image/sticker/video/audio/file/location
Rule 178 — Bot/AI reply trigger เฉพาะ msg_type='text' — type อื่นไม่ตอบ ประหยัด token
Rule 179 — raw_event เก็บ message_id สำหรับ LINE Content API
Rule 180 — chat-ui.js renderMessageContent() = source of truth render bubble
Rule 181 — LINE limitation: webhook ไม่ส่ง outbound — admin reply จาก OA Manager
           invisible (ไป Help/FAQ)
Rule 182 — deploy.sh ครอบเฉพาะ ACTIVE port (8000/9000) — modules/chat:8003 restart แยก
Rule 183 — หลังแก้ modules/chat/* → restart :8003 ด้วย:
             pkill -f "modules.chat.main:app"
             setsid nohup python -m uvicorn modules.chat.main:app --host 0.0.0.0 --port 8003 \
               > logs/chat.log 2>&1 < /dev/null & disown
Rule 184 — uploads path: /home/viivadmin/viiv/uploads/line/{tenant_id}/{conv_id}/{message_id}{ext}
Rule 185 — LINE content download = thread spawn (pattern เดียวกับ _ai_push_reply)
Rule 186 — Sticker ใช้ LINE CDN ตรง — ไม่ต้อง download
           URL: https://stickershop.line-scdn.net/stickershop/v1/sticker/{stickerId}/android/sticker.png
Rule 187 — Location ไม่ download — เก็บ lat/lng/maps_url ใน raw_event
Rule 188 — raw_event jsonb_set: media_url, media_size, latitude, longitude, maps_url
Rule 189 — Chat API GET messages ต้อง return media_url ใน response
Rule 190 — msg-media max-width 220px — ป้องกัน bubble กว้างเกิน
Rule 191 — /uploads/line/ Cache-Control max-age=86400 = tech debt
           ถ้า download fail แล้ว retry รอบ 2 จะค้าง 24 ชม. ที่ browser
           แก้ทีหลังเป็น immutable + versioned URL
Rule 192 — SQL :: cast operator ขัดกับ SQLAlchemy text() / psycopg2 parameter parser
           ใช้ CAST(:param AS type) แทนเสมอ — ไม่ใช่ :param::type
           (ผูกกับ Rule 11 และ Section [J] commit fbcff7a เดิม)
Rule 193 — restart chat:8003 หลัง pkill: ใช้ setsid + < /dev/null & disown
           ห้าม nohup ตรงๆ — pkill อาจฆ่า parent shell ก่อน detach

PROGRESS (Section [K] update)
Current State:
  Version: v3.2 | Updated: 2026-05-04
  Git Latest: 5db7fff

✅ Completed in this Phase:
  - LINE Webhook 7 message types (text/image/sticker/video/audio/file/location)
  - LINE Content Download (image/video/audio/file → /uploads/line/)
  - Sticker render via LINE CDN
  - Location render via Google Maps URL
  - Chat Dashboard render media จริง (img/video/audio/file/location)
  - AI/Bot reply gate — text only

🟢 Removed from Next Up:
  - Bot Phase 1 → ทำเสร็จแล้ว
  - Chat Dashboard ทดสอบ conversation จริง → ทำเสร็จแล้ว

🔴 Next Up เหลือ:
  1. notify_tenant_line() — push แจ้งเจ้าของร้าน
  2. Auto-inject tenant context (store_name, biz_type, products) เข้า AI prompt
  3. Draft 7 base prompts กลุ่ม Internal (ยัง [TODO])
  4. Bot Tool Library (Phase F) — search_products, create_bill, notify_owner
  5. AI Function Calling (structured command → Bot execute)

DECISIONS LOG (D53-D55) — Section [N]
D53 — LINE Content Download = thread spawn pattern (เดียวกับ _ai_push_reply)
      Sync ใน webhook = LINE timeout 1s + retry storm
      Thread = webhook 200 ทันที, download เบื้องหลัง, UI polling 2s rerender
D54 — Sticker render via CDN ตรง — ไม่ download server
      ลด bandwidth + storage, LINE CDN cache ดีอยู่แล้ว
D55 — AI reply gate text-only — non-text save metadata อย่างเดียว
      ป้องกัน AI ตอบมั่ว + ประหยัด token

TECH DEBT (carried forward)
⚠️ Cache 1 วัน /uploads/line/ — Rule 191 (แก้ทีหลัง)
⚠️ deploy.sh ไม่ครอบ chat:8003 (Rule 182) — Phase ถัดไปอาจ refactor
⚠️ id=105 รูปเก่าก่อน Phase 3 deploy — ไม่ back-fill (ไฟล์ไม่มีบน disk)

---

## [J] EOD 2026-05-07 — True Blue/Green Deploy Refactor

SUMMARY
- ระบบ deploy เดิมใช้ "rolling deployment with port swap" (detect ACTIVE → start
  STAGING → swap Caddy → kill old) → ทุก deploy สลับ test7 ↔ port → CGO สับสน
  ว่าวันนี้ test7 ชี้ port ไหน, dev environment ไม่ถาวร
- เปลี่ยนเป็น True Blue/Green: 1 port = LIVE (ลูกค้า, ถาวรเป็นเดือน),
  1 port = DEV (เราพัฒนา, ถาวรเป็นเดือน), swap แค่ตอน "cutover"
- Fixed mapping ใน Caddyfile: test7→:9000 (LIVE), dev7→:8000 (DEV)
- deploy.sh ลด blast radius: deploy ลง :8000 อย่างเดียว, ไม่แตะ Caddyfile,
  ไม่กระทบลูกค้า
- cutover.sh แยกออก: สลับ test7↔dev7 ใน Caddyfile + ยืนยัน "yes" + auto backup
- rollback.sh เปลี่ยนเป็น git checkout + redeploy DEV (ไม่ใช่ port swap)

CADDYFILE PATCH (/etc/caddy/Caddyfile)
- เพิ่ม block test7.viiv.me { ... reverse_proxy localhost:9000 ... }
  (เดิม fall through *.viiv.me — sed ใน cutover.sh จะ no-op)
- แก้ block dev7.viiv.me: localhost:9000 → localhost:8000
- /chat/* → :8003 (modulechat) คงเดิม
- *.viiv.me wildcard fallback → :9000 ไม่ต้องแก้
- Backup: /etc/caddy/Caddyfile.bak.20260507_044336

NEW DEPLOY ARCHITECTURE
```
test7.viiv.me  →  :9000 (LIVE)        — ลูกค้าจริง — ถาวร
dev7.viiv.me   →  :8000 (DEV)         — พัฒนา — ถาวร
*.viiv.me      →  :9000 (fallback)    — shop subdomain ทั่วไป
/chat/*        →  :8003 (modulechat)  — ทุก subdomain
```

CUTOVER FLOW (เดือนละครั้ง / feature ใหญ่เสร็จ)
1. dev7 (ใน :8000) ผ่าน QA แล้ว
2. รัน ~/viiv/cutover.sh → ยืนยัน "yes"
3. cutover.sh: detect current PROD port → swap test7↔dev7 ใน Caddyfile
   → caddy validate → systemctl reload → backup เดิมใน .bak.YYYYMMDD_HHMMSS
4. หลัง cutover: test7→:8000 (LIVE ใหม่), dev7→:9000 (DEV ใหม่)
5. CGO เริ่มพัฒนา round ถัดไปบน :9000 (port ที่กลายเป็น DEV)

FILES CHANGED
- ~/viiv/deploy.sh    (rewrite — DEV-only, no port swap)
- ~/viiv/cutover.sh   [NEW] — สลับ Caddy + verify health + backup
- ~/viiv/rollback.sh  (rewrite — git checkout + redeploy DEV)
- /etc/caddy/Caddyfile (test7 block + dev7 → :8000)

RULES ADDED
204  deploy.sh = deploy ลง :8000 (DEV) เท่านั้น — ไม่กระทบ production
205  cutover.sh = สลับ Caddy test7 → port ใหม่ — ใช้เมื่อ feature เสร็จและพร้อม release
206  Caddyfile fixed mapping: test7→:9000 (LIVE) | dev7→:8000 (DEV)
     mapping เปลี่ยนเฉพาะตอน cutover.sh เท่านั้น
207  Cutover frequency: เดือนละครั้ง หรือเมื่อ feature ใหญ่เสร็จ — ไม่ใช่ทุก deploy
208  ก่อน cutover.sh ครั้งแรก: ลบ duplicate `handle /chat/*` ใน test7+dev7 block
     (ดู TD-CADDY-DUPE ใน Section [K])
209  Backend success response = {"ok":true, "message":"success"}
     frontend check: if(d.ok) — standard เดียวกันทุกหน้า (ยังไม่ enforce ทุก endpoint)
210  join-shop รับ tenant_id ตรงๆ → backend lookup subdomain
     ไม่ใช้ strip https:// + .viiv.me อีกต่อไป (Rule 80 superseded)
211  store-settings มีปุ่ม Copy Shop ID — ใช้ navigator.clipboard.writeText()
     fallback: document.execCommand('copy')
212  test_dev = internal dev tenant (subdomain='dev7') อยู่ใน prod DB
     ยอมรับเป็น known limitation ระยะแรก

RULES SUPERSEDED
- Rule 80 (เดิม "join-shop input: strip https:// + .viiv.me + path")
  → ถูกแทนที่ด้วย Rule 210 (รับ tenant_id ตรงๆ → backend lookup subdomain)
- Rule 114 (เดิม "deploy.sh = restart Blue :8000 + health×3 + auto git revert HEAD")
  → ถูกแทนที่ด้วย Rule 204
- Rule 182 (เดิม "deploy.sh ครอบเฉพาะ ACTIVE port (8000/9000)")
  → ไม่เกี่ยวข้องอีก เพราะ deploy.sh ผูกกับ :8000 เสมอ ไม่ detect ACTIVE
  → tech debt "deploy.sh ไม่ครอบ chat:8003" ยังอยู่

NOTE
- CGO spec ระบุ "ลบ Rule 119, 120, 121, 122 + เปลี่ยน Rule 102" — Rules
  หมายเลขเหล่านี้ไม่มีอยู่ใน VIIV_MASTER.md (rules ปัจจุบันไปถึง 114
  แล้วกระโดด 177-193) — บันทึก superseded สำหรับ Rule 114 + 182 แทน

VERIFICATION (2026-05-07 04:43 UTC)
- :8000 process up (uvicorn app.main:app --port 8000) ✓
- :9000 process up (uvicorn app.main:app --port 9000, since 2026-05-04) ✓
- curl https://test7.viiv.me/api/platform/health → 200 (via :9000) ✓
- curl https://dev7.viiv.me/api/platform/health → 200 (via :8000) ✓
- caddy validate /etc/caddy/Caddyfile → "Valid configuration" ✓
- systemctl reload caddy → ok ✓

Version: v3.3 | Updated: 2026-05-07

---

## [J] EOD 2026-05-07 (Part 2) — Connections LINE Form + Copy Shop ID + join-shop tenant_id

SUMMARY
- ❶ Superboard connections LINE form: Fix A-D
  Fix A: field name line_oa_id → oa_id (frontend ส่งผิด → backend reject 400)
  Fix B: webhook URL /webhook/platform → /webhook?tenant={tid} per-tenant
  Fix C: cnLoadSettings() display อ่าน d.line_oa_id → d.oa_id
  Fix D: response handler — accept d.message==='success' จาก backend
  helper ใหม่: cnGetTid() inline (Pattern 1 — JWT decode + padding fix)
- ❷ store-settings: ปุ่ม Copy Shop ID ติดข้าง field id-Shop
  ใช้ navigator.clipboard.writeText() + execCommand fallback
  feedback "✓ คัดลอกแล้ว" 1.5s แล้ว revert
- ❸ join-shop: subdomain → tenant_id (Superboard + PWA + Backend)
  Frontend: label/placeholder/help text + body field + caller call site
  Backend: query WHERE id=:tid + validation len>=4
  stripSubdomain() helper เก็บไว้ unused (compat) — ลบในรอบถัดไป

COMMITS (4 commits, ทั้งหมด push origin/main แล้ว)
  280ce88  fix(superboard/connections): LINE form save + webhook URL + response handler
  84ef0d1  feat(store-settings): add Copy Shop ID button
  d0729a6  feat(join-shop): accept tenant_id instead of subdomain (Superboard + PWA)
  (รวม VIIV_MASTER docs commit ตามรอบนี้)

FILES CHANGED
  app/api/platform_connections.py            (join-shop tenant_id lookup)
  frontend/superboard/index.html             (popup HTML + saveShopAdd + switchShop)
  frontend/superboard/pages/connections.html (Fix A-D)
  frontend/superboard/pages/store-settings.html (Copy Shop ID button)
  frontend/pwa/index.html                    (popup HTML + bump v=6881)
  frontend/pwa/js/app.js                     (select + saveAdd)
  modulechat/ui/dashboard/index.html         (bump v=6881)

DECISIONS ADDED (Section [C])
D59  test_dev = internal dev tenant อยู่ใน prod DB
     เมื่อมีลูกค้าจริง → พิจารณา Supabase dev project แยก
D60  Multi-branch: คง 1 tenant per branch (Option A)
     จนมีลูกค้า chain จริงๆ มาขอ
D61  join-shop: รับ tenant_id แทน subdomain
     Platform Board = backlog (ลำดับยังไม่ถึง)

PHASE DONE (เพิ่มในรายการเสร็จ)
  ✅ True Blue/Green deploy (fixed mapping)
  ✅ test_dev tenant + dev7 environment แยก
  ✅ Superboard connections LINE form (Fix A-D)
  ✅ store-settings Copy Shop ID
  ✅ join-shop: tenant_id input (Superboard + PWA + Backend)

KNOWN ISSUES / TECH DEBT (Section [K] update)
⚠️  Fix E ยังค้าง: saveFeatures() + quote-config ใน connections.html
    ใช้ if(d.ok||d.status==='ok') แต่ backend return {message:'success'}
    → save จริงผ่านแต่ UI แสดง error (เหมือน Fix D ที่แก้แล้ว)
    Action: เพิ่ม `d.message==='success'` ใน success check 2 จุด
⚠️  stripSubdomain() ใน superboard/index.html = unused (tech debt)
    ลบได้ในรอบถัดไป
⚠️  TD-CADDY-DUPE: dev7+test7 block มี handle /chat/* ซ้ำ 2 ครั้ง
    ต้องลบก่อน cutover.sh ใช้จริงครั้งแรก (Rule 208)
⚠️  JWT decode duplicate 4-5 จุดทั่วระบบ
    superboard/index.html:725, 457, 1028  ✅ มี padding fix
    connections.html (cnGetTid)            ✅ มี padding fix (Pattern 1, ใหม่)
    merchant/store.html:586                ❌ ไม่มี padding fix
    superboard/dashboard/app.js:376        ❌ ขาด padding
    TODO: cleanup เป็น sbGetTenantId() ใน auth.js (Pattern 2)

Version: v3.4 | Updated: 2026-05-07
Git Latest: d0729a6

---

## [J] EOD 2026-05-07 (v3.5 — Full day) — Standardize + ai-brain persona + cutover atomic

SUMMARY (24 hours, 10 commits)
- ❶ True Blue/Green deploy refactor + cutover.sh + Caddyfile fixed mapping (commit 44bc2e3)
- ❷ TD-CADDY-DUPE log + cleanup (4dac07e + 4c376f3)
- ❸ Superboard connections LINE form Fix A+B+C+D (280ce88)
- ❹ store-settings: Copy Shop ID (84ef0d1) + วันเริ่มใช้งาน + เรียนรู้ popup + ปุ่มบันทึกล่าง (baa6bc8)
- ❺ join-shop: subdomain → tenant_id ทั้ง Superboard + PWA + Backend (d0729a6)
- ❻ Superboard scroll fix #sbContent overflow:auto (3796e0a)
- ❼ ai-brain persona tab + ai_personas DB + tenant DB read (0ac583e)
- ❽ Caddyfile cleanup duplicate /chat/* + cutover.sh covers concore + deploy.sh auto-detect DEV (4c376f3)
- ❾ Caddyfile standardize ทุก non-DEV block → :8000 + cutover.sh atomic 7 blocks (0752be6)
- ❿ VIIV_MASTER v3.4 + v3.5 docs (dba54b3 + this)

RULES (current state — Rules 204-220)
204  deploy.sh = deploy ลง DEV port เท่านั้น — auto-detect จาก Caddyfile dev7 block
205  cutover.sh = swap ทุก LIVE blocks atomic (7 blocks: test7/concore/auth/viiv/merchant/api/*.viiv.me)
     ทำเมื่อ feature ใหญ่เสร็จ — ไม่ใช่ทุก deploy
206  Caddyfile fixed mapping: LIVE blocks → :8000 | DEV (dev7) → :9000
     mapping เปลี่ยนเฉพาะตอน cutover.sh เท่านั้น
207  Cutover frequency: เดือนละครั้ง หรือเมื่อ feature ใหญ่เสร็จ
208  TD-CADDY-DUPE: RESOLVED — duplicate /chat/* ลบแล้วใน test7+dev7 blocks
209  Backend success response = {"ok": true, "message": "success"}
     frontend check: if(d.ok || d.message==='success') — standard เดียวกัน
210  join-shop รับ tenant_id ตรงๆ → backend lookup subdomain
     Rule 80 superseded — ไม่ใช้ strip https:// + .viiv.me อีกต่อไป
211  store-settings มีปุ่ม Copy Shop ID + ปุ่มบันทึกด้านล่าง
212  test_dev = internal dev tenant (subdomain='dev7') อยู่ใน prod DB
     ยอมรับเป็น known limitation ระยะแรก
213  ai_personas table = source of truth สำหรับ persona label + description
     PERSONA_MAP ใน pos_line.py = behavioral only (suffix/greeting/sign) ไม่เปลี่ยน
214  /api/platform/ai/personas = admin CRUD (GET+PATCH) — platform_token required
     /api/tenant/personas = tenant read-only — อ่านจาก ai_personas DB (fallback hardcode)
215  persona tab ใน ai-brain = Platform admin เท่านั้น
     Superboard = read-only dropdown (label จาก DB)
216  Caddyfile LIVE blocks = test7, concore, auth, viiv, merchant, api, *.viiv.me
     DEV block = dev7 เท่านั้น — ห้าม swap dev7 ใน cutover.sh
217  cutover.sh atomic: swap ทุก LIVE block ใน reload เดียว — ไม่มี drift
218  merchant.viiv.me ใช้ pattern localhost: (normalized จาก 127.0.0.1:)
219  Superboard #sbContent: overflow:auto (ไม่ใช่ hidden) — inline pages scroll ได้
220  store-settings วันเริ่มใช้งาน = tenants.created_at (format th-TH พ.ศ.)

RULE SUPERSEDED
- Rule 80 → Rule 210 (join-shop: tenant_id แทน subdomain)

DELTA from v3.4 (สิ่งที่เปลี่ยน wording จาก v3.4 → v3.5)
- Rule 204: ":8000 (DEV) เท่านั้น" → "DEV port เท่านั้น — auto-detect"
- Rule 205: "Caddy test7 → port ใหม่" → "ทุก LIVE blocks atomic (7 blocks)"
- Rule 208: "ก่อน cutover.sh ครั้งแรก: ลบ duplicate" → "TD-CADDY-DUPE: RESOLVED"
- Rule 209: เพิ่ม "ok: true" ใน response standard + frontend "if(d.ok || d.message==='success')"
- Rule 211: เพิ่ม "+ ปุ่มบันทึกด้านล่าง"

DECISIONS ADDED (Section [N], beyond D59-D61 ที่ v3.4 มีแล้ว)
D62  ai_personas DUAL SOURCE → ระยะสั้นยอมรับ 2 ที่
     pos_line.py PERSONA_MAP = behavioral
     ai_personas DB = display (label + description)
     ระยะยาว: ย้าย behavioral ไป DB ด้วย (Phase 3)
D63  cutover.sh atomic 7 blocks — ป้องกัน drift ระหว่าง subdomain
D64  Caddyfile standardize: ทุก non-DEV block → LIVE port
     merchant normalized: 127.0.0.1 → localhost

PHASE DONE (10 รายการเพิ่ม / cumulative)
✅ True Blue/Green + Full standardize (7 blocks atomic)
✅ test_dev tenant + dev environment แยก production
✅ connections.html Fix A+B+C+D (LINE form ครบ)
✅ store-settings: Copy Shop ID + วันเริ่มใช้งาน + เรียนรู้ popup + ปุ่มบันทึกล่าง
✅ join-shop: tenant_id input (Superboard + PWA + Backend)
✅ Superboard scroll fix (#sbContent overflow:auto)
✅ ai-brain: tab บุคลิก AI (6 cards + CRUD + ai_personas DB)
✅ /api/tenant/personas อ่านจาก DB
✅ Chat + LINE end-to-end บน test_dev
✅ cutover.sh atomic (7 blocks) + Caddyfile standardize

GIT RESTORE POINTS (today, newest first)
0752be6  feat: Caddyfile standardize + cutover atomic 7 blocks
4c376f3  fix(caddy): cleanup duplicate /chat/* + extend cutover.sh for concore
0ac583e  feat(ai-brain): persona tab B1+B2+B3
3796e0a  fix(superboard): #sbContent overflow hidden → auto
baa6bc8  feat(store-settings): A1+A2+A3
dba54b3  docs: VIIV_MASTER v3.4
d0729a6  feat(join-shop): tenant_id (Superboard + PWA + Backend)
84ef0d1  feat(store-settings): Copy Shop ID button
280ce88  fix(superboard/connections): LINE form Fix A+B+C+D
44bc2e3  feat: True Blue/Green deploy

CURRENT STATE
Version: v3.5 | Updated: 2026-05-07
Git Latest: 0752be6
LIVE (:8000): test7, concore, auth, viiv, merchant, api, *.viiv.me
DEV  (:9000): dev7 เท่านั้น
modulechat:   :8003
moduleai:     :8002

KNOWN ISSUES / TECH DEBT (cumulative)
⚠️  Fix E ยังค้าง: saveFeatures() + quote-config ใน connections.html
    (save จริงผ่าน แต่ UI แสดง error — เหมือน Fix D ที่แก้แล้ว)
⚠️  Phase 4 verify ยังไม่ครบ (logo upload + POS sync)
⚠️  Auto-inject tenant context เข้า AI prompt ยังไม่ทำ
⚠️  7 base prompts กลุ่ม Internal ยังเป็น [TODO]
⚠️  4+ commits เก่ายังไม่ push remote (12ca6d8, 7e0541f, f1beec3, a416008)
⚠️  DUAL SOURCE persona: pos_line.py PERSONA_MAP + ai_personas DB
⚠️  stripSubdomain() ใน superboard/index.html = unused tech debt
⚠️  JWT decode duplicate 4-5 จุด:
    superboard/index.html:725, 457, 1028  ✅ padding fix
    connections.html (cnGetTid)            ✅ padding fix
    merchant/store.html:586                ❌ ไม่มี padding fix
    superboard/dashboard/app.js:376        ❌ ขาด padding
⚠️  ai-bot.html CRUD ยังไม่ทดสอบจริง
⚠️  BILLING_GUARD_MODE=report (ยังไม่ enforce)
⚠️  BILLING_SCHEDULER_DRY_RUN=1 (ยังไม่เปิด LINE จริง)
⚠️  BIZ_TYPES ใน tenant_settings.py = temporary list

NEXT UP (Priority)
🔴 Fix E: saveFeatures() + quote-config response handler ใน connections.html
🟡 Phase 4 verify ครบ (logo upload + POS sync)
🟡 Auto-inject tenant context (store_name, biz_type, products) เข้า AI prompt
🟡 Draft 7 base prompts กลุ่ม Internal
🟡 Push 4+ commits ค้าง

Version: v3.5 | Updated: 2026-05-07 (EOD)

---

## [J] EOD 2026-05-07 (v3.6 — Phase 1 API Gateway Foundation)

PHASES COMPLETE — เพิ่ม
✅ Phase 1 — API Gateway Foundation (2026-05-07)
   - Schema 7 tables: api_endpoints, api_health_log, credit_pricing,
     credit_ledger, credit_topups, topup_packages, api_gateway_settings
   - ALTER ai_tenant_credits: 3-pool (credit_subscription/rollover/topup)
   - UNIQUE(method, path, port) on api_endpoints
   - Seed: 52 endpoints, 8 credit actions, 5 topup tiers, 7 gateway settings
   - Migration: credit เก่า → credit_topup pool (0 entries — ยังไม่มี tenant credit)
   - Sidebar: API Gateway ▼ (5 sub-menus) แทนที่ API Keys standalone
   - Placeholder pages 4 หน้า (Phase 2 implement จริง)
   git: 01cd0c0

NEXT UP PRIORITY — เพิ่ม
Phase 2 — API Gateway UI (เรียงลำดับ)
  B. Credit Pricing page — CRUD หน้า edit credit_pricing table
  C. Top-up Packages page — CRUD หน้า edit topup_packages table
  D. Top-up Approvals page — ดูสลิป + approve/reject credit_topups
  A. Health Monitor page — ping api_endpoints แสดง healthy/failed
  E. Enforcement decorator — @gateway_check หัก credit + quota gate

KNOWN ISSUES — เพิ่ม
⚠️  Phase 2 API Gateway UI ยังไม่มี logic (placeholder เท่านั้น)
⚠️  credit enforcement ยังไม่ implement (Phase 2E)
⚠️  Health Monitor cron ยังไม่มี (Phase 2A)

DECISIONS ADDED (Section [N]) — เลขถัดจาก D64
D65  API Gateway = unified control plane
     Health/Pricing/Topup/Keys อยู่ใต้ menu เดียวใน SYSTEM section
     5 sub-menus: Health Monitor / Credit Pricing /
     Top-up Packages / Top-up Approvals / API Keys
D66  3-pool credit system: credit_subscription / credit_rollover / credit_topup
     Consumption order (Phase 2): Sub → Rollover → Topup (atomic)
     credit_subscription = รีเซ็ตทุกเดือน
     credit_rollover = subscription เหลือ ทบเดือนถัดไป (1 รอบ)
     credit_topup = สะสมตลอดชีพ (lifetime ไม่หมดอายุ)
D67  Migration credit เก่า → credit_topup pool
     เหตุผล: ลูกค้าไม่เสียเปรียบจาก migration
     credit ที่มีก่อนหน้าจะไม่ถูก reset ตามรอบเดือน
D68  Refund (action fail) → credit_topup pool
     เหตุผล: simple + เป็นมิตรกับลูกค้า
     ไม่ต้อง track pool ที่หักล่าสุด

RULES ADDED (Section [J]) — เลขถัดจาก 220
221  ai_tenant_credits 3-pool: credit_subscription/rollover/topup
     remaining = sum ทั้ง 3 pool
     credit_used = ใช้ไปทั้งหมดในรอบเดือน
222  Consumption order (Phase 2 implement): Sub → Rollover → Topup (atomic)
     เหตุผล: ลูกค้าจ่ายเงินจริง (Topup) ควรอยู่ทนสุด
223  ทุก credit movement → log credit_ledger เสมอ
     txn_type: consume/topup/subscription/refund/adjust/reset/migrate
     amount: + เพิ่ม | - ลด | balance_after = snapshot หลัง transaction
224  api_gateway_settings = config table สำหรับ API Gateway
     health_check_interval_min default 60
     แก้ผ่าน Platform UI ได้ (Phase 2A) ไม่ต้อง deploy
225  topup_packages = scale tier (จ่ายเยอะ ได้เยอะกว่าสัดส่วน)
     credits field = จำนวนจริงที่ได้ (รวม bonus แล้ว) ไม่คูณซ้ำ
226  credit migrate flow: txn_type='migrate' source='migration_v1'
     idempotent: WHERE NOT EXISTS migrate ledger
     รันซ้ำได้ปลอดภัย

Version: v3.6 | Updated: 2026-05-07
Git Latest: fa7af4a (Phase 1 frontend + bump committed)

---

Version: v3.2 | Updated: 2026-05-04 | Git Latest: 5db7fff