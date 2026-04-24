VIIV MASTER — CGO Reference
> **copy ไฟล์นี้ทั้งหมดเพื่อเปิดแชทใหม่กับ CGO ทุกครั้ง**  
> Version: v1.18 | Updated: 2026-04-24  
> Claude Code อัปเดต Section [E] ทุกสิ้นวัน
---
[A] ROLE & WORKFLOW
บทบาท
CGO (Claude.ai Pro) = ผู้กำหนดทิศทาง, architecture, spec, token budget
Claude Code (API) = executor เขียนโค้ดตาม spec ที่ CGO กำหนด
เจ้าของโปรเจกต์ = ส่ง spec ให้ CGO → CGO แปลงเป็น task → Claude Code implement
Daily Workflow
```
เช้า:     copy VIIV_MASTER.md ทั้งไฟล์ → เปิดแชทใหม่ → CGO เก็ต context 100%
ระหว่างวัน: CGO ออก spec → Claude Code implement → test
เย็น:     CGO สั่ง Claude Code: "สรุปวันนี้ เพิ่มใน VIIV_MASTER.md Section [E]"
พรุ่งนี้: copy ไฟล์ใหม่ → เปิดแชท → ทำต่อ
```
Model Policy
```
claude-haiku-4-5   → งานทั่วไป (edit, debug, < 100 บรรทัด)
claude-sonnet-4-6  → complex logic, multi-file, architecture
claude-opus        → ห้ามใช้ยกเว้น CGO อนุมัติ
```
Token Rules
Claude Code อ่านเฉพาะไฟล์ที่เกี่ยวกับ task นั้น
ถ้า task ต้อง read > 3 ไฟล์ → แจ้ง CGO ก่อน แบ่ง task
ห้าม loop/retry เกิน 3 ครั้งโดยไม่แจ้ง
---
[B] ARCHITECTURE
Stack
```
Runtime:   FastAPI Python 3.12
Database:  Supabase / PostgreSQL
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
File Structure (v1.17)
```
/home/viivadmin/viiv/
├── .env
├── app/
│   ├── main.py
│   └── api/
│       ├── pos_bills.py, pos_members.py, pos_store.py
│       ├── pos_products.py, pos_categories.py
│       ├── pos_affiliate.py, pos_partners.py
│       ├── pos_receive.py, pos_line.py
│       ├── pos_line_settings.py, pos_bank.py
│       └── login.py
├── frontend/
│   ├── superboard/
│   │   ├── index.html              SPA shell (desktop)
│   │   ├── dashboard/              Living Dashboard (isolated iframe)
│   │   ├── mobile/index.html       ✅ light theme + profile + PTR
│   │   └── pages/
│   └── pwa/                        PWA Shell — Phase 1 ✅ Done
│       ├── index.html
│       ├── manifest.json
│       ├── sw.js
│       ├── css/app.css             Design system v1.17
│       ├── js/router.js, app.js
│       └── pages/
│           ├── home.js      ✅ Living Dashboard + module cards
│           ├── pos.js       ✅ POS Hub + 9-menu + ออกบิล sub-sheet
│           ├── billing.js   ✅ ออกบิล + cart + payment sheet
│           ├── orders.js    ✅ list + filters + detail (markPaid/void)
│           ├── products.js  ✅ CRUD + image upload + receive history
│           ├── members.js   ✅ list + search + tier badges
│           ├── store.js     ✅ 7 tabs: คลัง/สร้าง/รับ/ตัด-ย้าย/Bundle/พิมพ์/หมวดหมู่
│           ├── more.js      ✅ navigation drawer
│           ├── chat.js      🚧 Phase 2
│           └── autopost.js  🚧 Phase 2
├── modulpos/    ← Legacy (อย่าแตะ)
├── modulechat/  ← Legacy foundation
└── modulepost/  ← Legacy foundation
```
Working Files (ห้ามสับสน)
```
Backend จริง:  app/api/pos_*.py       ✅
Frontend จริง: frontend/pwa/          ✅
Legacy:        modulpos/ modulechat/ modulepost/  ❌ อย่าแตะ
Asset version: ?v=1166
```
API Endpoints
```
/api/pos/bills/*      — bills CRUD
/api/pos/products/*   — products CRUD
/api/pos/categories/* — categories CRUD
/api/pos/members/*    — members CRUD
/api/pos/partners/*   — partners CRUD
/api/pos/affiliate/*  — affiliate CRUD
/api/pos/store/*      — store settings
/api/pos/bank/*       — bank accounts
/api/pos/receive/*    — stock receive
/api/line/*           — LINE webhook
/api/pos/line/*       — LINE settings

POS Mobile API:
GET /api/pos-mobile/summary
GET /api/pos-mobile/bills/recent
GET /api/pos-mobile/products/list
GET /api/pos-mobile/members/list

Chat & Post (Foundation):
GET /api/chat/summary, /live-feed, /sessions
GET /api/post/summary, /posts, /queue
```
Domains & Routing
```
concore.viiv.me              → /frontend (Superboard desktop)
m.viiv.me                    → /superboard/mobile/ (Mobile Shell)
*.viiv.me/pwa/*              → /frontend/pwa/ (PWA ใหม่)
*.viiv.me/modulpos/*         → /modulpos/frontend/ (legacy)
chat.viiv.me                 → /modulechat/frontend/
post.viiv.me                 → /modulepost/frontend/
```
Caddyfile Handles (wildcard block)
```
handle /uploads/*   → /home/viivadmin/viiv  (Cache-Control: no-store)
handle /api/*       → localhost:8000
handle /merchant/*  → modules/pos/merchant/ui/dashboard
handle /superboard/*→ frontend/
handle /pwa/*       → frontend/
handle /modulpos/*  → modulpos/frontend/
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

# Reload Caddy
sudo systemctl reload caddy

# Check RAM
ps aux --sort=-%mem | head -8

# Realtime log
tail -f /home/viivadmin/viiv/logs/uvicorn.log
```
RAM Usage
```
VS Code Remote SSH:  ~1,150 MB
uvicorn:             ~106 MB
Caddy:               ~44 MB
PostgreSQL:          ~28 MB
Production total:    ~180 MB
```
Blue-Green Deployment
```
Blue (production):  /home/viivadmin/viiv/       port 8000
Green (staging):    /home/viivadmin/viiv-green/  port 8001
```
```bash
# swap.sh
kill $(lsof -ti:8000) 2>/dev/null && sleep 1
cd /home/viivadmin/viiv-green && source .venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > logs/uvicorn.log 2>&1 &

# rollback.sh
kill $(lsof -ti:8000) 2>/dev/null && sleep 1
cd /home/viivadmin/viiv && source .venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > logs/uvicorn.log 2>&1 &
```
PWA Architecture
```
Pull-to-refresh:  #page-container (native scroll) → touchstart → spinner → dispatch 'viiv:refresh'
Router:           Router.go('page', params) / Router.back() / Router.register(name, {load, destroy})
Token flow:       postMessage → App.token → App.api() → localStorage fallback
Design tokens:    --gold, --bg, --card, --bdr, --txt, --muted
                  --topbar-h:48px --navbar-h:58px --safe-bot:env(safe-area-inset-bottom)
```
---
[C] DECISIONS LOG
Confirmed Architecture Decisions
#	Decision	ยืนยันเมื่อ
1	Mobile → PWA (no iframe) แก้ปัญหา PTR/keyboard/swipe	v1.14
2	Feature Flag: guard ทั้ง Frontend (UX) + Backend API (Security)	v1.16
3	Feature Flag timing: ทำหลัง PWA Phase 2 เสร็จ ก่อน Blue/Green	v1.16
4	UX locked/feature: กดแล้วขึ้น "ต้องการแพ็คเกจ Pro — ดูแพ็คเกจ →"	v1.16
5	LangChain: ใช้จริง (Chat + AutoPost + POS Bot ต้องการ 80% ของโปรเจกต์)	v1.16
6	AI Tier: haiku (basic) / sonnet (pro) / opus (enterprise)	v1.16
7	AI Cost: token budget per tenant + hard limit + soft warning 80%	v1.16
8	AI Latency: POS=pre-cache, Chat=streaming SSE, AutoPost=async queue	v1.16
9	POS Bot scope: Help Only (อธิบาย/query) — ห้าม action v1.16 ยันไป	v1.16
10	Claude Code model: haiku default, sonnet complex, opus ห้าม	v1.17
11	Memory system: CLAUDE.md (server) + VIIV_MASTER.md (CGO daily)	v1.17
Feature Flag Schema (ยืนยันใช้แบบนี้)
```json
{
  "tenant_id": "ten_1",
  "package": "pro",
  "features": {
    "pos.billing": true,
    "pos.products.create": true,
    "pos.affiliate": false,
    "chat.live": false,
    "ai.assistant": "basic",
    "ai.tokens_per_month": 50000
  }
}
```
AI Quota Tables (ทำทันทีพร้อม Feature Flag)
```sql
CREATE TABLE tenant_ai_quota (
  tenant_id     TEXT PRIMARY KEY,
  package       TEXT,
  model_allowed TEXT,
  tokens_limit  INTEGER,
  tokens_used   INTEGER DEFAULT 0,
  reset_date    DATE,
  warned_80     BOOLEAN DEFAULT false
);

CREATE TABLE ai_usage_log (
  id          SERIAL PRIMARY KEY,
  tenant_id   TEXT,
  module      TEXT,
  model       TEXT,
  tokens_in   INTEGER,
  tokens_out  INTEGER,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```
---
[D] KNOWN RULES & ISSUES
Rule 16 — Cloudflare Cache 404: `/uploads/` ต้องมี Bypass Cache rule + `concore.viiv.me` block ต้องมี `/uploads/*` handler แยก
Rule 17 — JS var scope: `var` ใน `try{}` → declare ที่ function scope บนสุด
Rule 18 — Caddyfile concore block ต้องมี `/uploads/*` handler แยก
Rule 19 — Mobile iframe back button: `history.pushState()` + `popstate` intercept (แก้แล้ว v1.13)
Rule 20 — iframe Pull-to-refresh: ทำไม่ได้ → แก้ถาวรด้วย PWA (v1.14)
Rule 21 — PWA PTR: เช็ค `container.scrollTop === 0` ก่อน start pull
Rule 22 — ห้าม `localStorage.removeItem('viiv_token')` ยกเว้น explicit logout  
→ 401 ให้ setItem(dev token) แทน ไม่ใช่ removeItem
Rule 23 — dashboard.html ต้องมี dev token bootstrap + `/merchant/*` Caddyfile ต้องมี `Cache-Control: no-store`
Rule 24 — Dev token (ten_1/usr_1) ชั่วคราว — ห้าม deploy ให้ลูกค้าจริง
Rule 25 — Field names ที่ถูกต้อง:
```
vat          ✅  (ไม่ใช่ vat_type)
min_alert    ✅  (ไม่ใช่ min_stock_alert)
stock_back   ✅  คลังหลังร้าน
track_stock  ✅  boolean
pay_method   ✅  ใน bills (ไม่ใช่ payment_method)
category     ✅  ใน products (ไม่ใช่ category_id)
```
---
[E] PROGRESS
Current State
```
Version:      v1.18
Phase:        PWA Mobile Phase 1 ✅ Done → Phase 2 กำลังจะเริ่ม
Last updated: 2026-04-24
Git latest:   (pending commit) store.js v1.18 — 7-tab full parity with PC
```
PWA Pages Status
ไฟล์	สถานะ	หมายเหตุ
home.js	✅ Done	Living Dashboard + module cards + tickers
pos.js	✅ Done	POS Hub + 9-menu + ออกบิล sub-sheet + สโตร์ slot
billing.js	✅ Done	ออกบิล + cart + payment sheet
orders.js	✅ Done	list + filters + detail (markPaid/void)
products.js	✅ Done	CRUD + image upload + receive history
members.js	✅ Done	list + search + tier badges
store.js	✅ Done v1.18	7 tabs full: คลัง(filter/search/edit-sheet) + สร้าง + รับสินค้า + ตัด/ย้าย + Bundle(placeholder) + พิมพ์(stock/ป้าย) + หมวดหมู่ CRUD
more.js	✅ Done	navigation drawer
chat.js	🚧 Phase 2	placeholder
autopost.js	🚧 Phase 2	placeholder
Next Up (ลำดับ Priority)
```
1. 🔴 HIGH  — PWA billing: เพิ่ม discount, VAT, doc type (invoice/receipt)
2. 🔴 HIGH  — pos_line.py: LINE Webhook + pending-uid
3. 🟡 MED   — PWA orders: shipping status update
4. 🟡 MED   — PWA members: add/edit member form
5. 🟡 MED   — Dashboard API: ยอดแชท, Affiliate, AutoPost (ไม่ใช่ mock)
6. 🟡 MED   — PWA Phase 2: easysale, affiliate, finance
7. 🟡 MED   — Feature Flag Schema + AI Quota Tables (DB)
8. 🟡 MED   — Blue-Green setup: สร้าง viiv-green + scripts
9. 🔵 FUT   — PWA Phase 3: receive, settings
10. 🔵 FUT  — Capacitor.js → APK/IPA
```
Completed Log
[2026-04-24 v1.18]
✅ store.js — Rewrite ครบ 7 tabs (full parity with PC):
   Tab1 คลังสินค้า: cards(48px thumb+name+SKU+cat+price/cost/margin+stock front/back+badge)+search+filter(stock/cat)+bottom-sheet edit (form ครบ: name/sku/cat/price/PL/cost/PV/VAT/track_stock/stock/stock_back/min_alert/status/desc/image)+set inactive
   Tab2 สร้างสินค้า: same form+POST create → toast+switch Tab1+reload
   Tab3 รับสินค้า: product picker(search+qty+cost+warehouse) → POST /receive/create + history list
   Tab4 ตัด/ย้าย: sub-tabs ตัดสต็อก(wh+stepper+PUT update) + ย้ายระหว่างคลัง(direction+stepper+PUT update)
   Tab5 ชุดสินค้า: placeholder (รอ backend endpoint)
   Tab6 พิมพ์: พิมพ์สต็อก(A4 window.print) + พิมพ์ป้าย(checkbox select+ขนาด+เนื้อหา+window.print)
   Tab7 หมวดหมู่: GET/POST/PUT/DELETE /api/pos/categories/* + create/edit bottom-sheet + delete confirm
✅ index.html — bump store.js ?v=1165 → ?v=1166
✅ VIIV_MASTER.md — updated to v1.18

[2026-04-24 v1.17]
✅ app.css — fix #page-container transparent overlap bug (เพิ่ม background: var(--bg))
✅ pos.js — tile "ออกบิล" → bottom sheet ย่อย [ออกบิลใหม่][ค้นหาบิล]
✅ pos.js — slot 7 เปลี่ยนจาก "ค้นหาบิล" → "🏪 สโตร์"
✅ store.js — หน้าใหม่ 3 tabs: คลังสินค้า, ตัดสต็อก, พิมพ์ป้าย
✅ more.js — เพิ่ม "🏪 สโตร์" ใน section โมดูล
✅ index.html — เพิ่ม store.js, bump ?v=1164
[2026-04-24 v1.16]
✅ modulpos/api/routes.py — fix field names: min_alert, pay_method, track_stock
✅ superboard/mobile/index.html — clean refactor 484 lines: token broadcast, lazy iframe, PTR, back button
✅ products.js v3 — complete rewrite: status filter, category chips, image upload, stock_back, qr_url, receive history
[2026-04-23 v1.15]
✅ PWA Phase 1 complete: home, billing, orders (+detail), products, members, more, pos hub
✅ app.css Design system overhaul
✅ Order detail: markPaid, void, receipt view
✅ Mobile Shell light theme + profile bottom-sheet
Git Restore Points
```
f3adb9c  Superboard Dashboard Live4/4 (safe)
ab5ec4d  PWA shell foundation
c778e1d  PWA Phase 1 complete
c91cfec  Mobile shell light theme + profile
ae6cd1e  PWA Phase 1 checkpoint
266fb3e  PWA สินค้า v3 complete
4774970  Mobile shell cleanup + fix modulpos API
7c8d386  PWA สโตร์ + ออกบิล sub-menu + overlap fix ← LATEST SAFE
```
Known Issues (store.js v1.18)
```
- Tab5 ชุดสินค้า: รอ backend bundle endpoints (pos_products.py ไม่มี /bundles/*)
- Tab4 ตัด/ย้าย: ใช้ PUT /products/update แทน dedicated stock-adjust endpoint (ไม่มีใน backend)
- Tab3 รับสินค้า: receive endpoint อัปเดต stock_qty หน้าร้านเท่านั้น (warehouse='back' ใน DB แต่ code +stock_qty)
```
Blockers
```
(ไม่มีในปัจจุบัน)
```
---
[F] ROADMAP
```
ตอนนี้ (Phase 2):
  PWA billing: discount/VAT/doc-type
  pos_line.py: LINE webhook
  PWA orders: shipping
  PWA members: CRUD

เดือน 1-2:
  Feature Flag (Backend middleware + Frontend UX)
  AI Quota Tables (DB schema)
  Blue/Green setup + deploy

เดือน 2-3:
  LangChain foundation
  POS Help Bot (pre-cache RAG)
  Chat Module AI (streaming SSE)

เดือน 3-4:
  AutoPost AI (async queue)
  PWA Phase 3: receive, settings

อนาคต (v2.x):
  Capacitor.js → APK + IPA
  App Store / Play Store

อนาคตไกล (v3.x):
  AI Chat Interface ("ออกบิล 3 รายการให้ลูกค้าสมชาย")
```
---
> **CGO Note:** ไฟล์นี้ = source of truth สำหรับทุก session  
> Claude Code อัปเดต Section [E] ทุกสิ้นวัน  
> Version bump ทุกครั้งที่มี decision หรือ progress ใหม่