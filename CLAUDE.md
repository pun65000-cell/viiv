VIIV POS Project Bible v1.16
> Updated: 2026-04-23 | ต่อจาก v1.15
---
1. โครงสร้างระบบ
Stack: FastAPI (Python 3.12) + Supabase/PostgreSQL + Caddy + Uvicorn port 8000  
Path: `/home/viivadmin/viiv/`  
Domain: `concore.viiv.me`  
Dashboard: `/merchant/dashboard.html`  
JWT_SECRET: `21cc8b2ff8e25e6262effb2b47b15c39fb16438525b6d041bb842a130c08be7c`  
Architecture: SPA embedded ใน VIIV Superboard — auth ควบคุมโดย Superboard, POS ใช้ token จาก Superboard
---
2. Restart & Test Commands
```bash
# Restart server
kill $(lsof -ti:8000) 2>/dev/null && sleep 1
cd /home/viivadmin/viiv && source .venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > logs/uvicorn.log 2>&1 &
sleep 2 && tail -3 logs/uvicorn.log

# Test token
TOKEN=$(python3 -c "import jwt; print(jwt.encode({'tenant_id':'ten_1','user_id':'usr_1'}, '21cc8b2ff8e25e6262effb2b47b15c39fb16438525b6d041bb842a130c08be7c', algorithm='HS256'))")
curl -s http://localhost:8000/api/pos/partners/list -H "Authorization: Bearer $TOKEN"

# ดู log realtime
tail -f /home/viivadmin/viiv/logs/uvicorn.log
```
---
3. Caddy Config Pattern
```bash
# แก้ Caddyfile (sudoers ตั้งไว้แล้ว ไม่ถาม password)
python3 << 'PYEOF'
path = '/etc/caddy/Caddyfile'
with open(path, encoding='utf-8') as f:
    c = f.read()
# แก้ไข c ที่นี่
with open('/tmp/Caddyfile.new', 'w') as f:
    f.write(c)
print("✅ written")
PYEOF
sudo cp /tmp/Caddyfile.new /etc/caddy/Caddyfile
sudo systemctl reload caddy && echo "✅ reloaded"
```
sudoers (ไม่ถาม password):
`sudo systemctl reload caddy`
`sudo systemctl restart caddy`
`sudo cp /tmp/Caddyfile.new /etc/caddy/Caddyfile`
---
4. File Structure (v1.15)
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
│   │   ├── index.html           SPA shell (desktop)
│   │   ├── dashboard/           Living Dashboard (isolated iframe)
│   │   │   ├── index.html
│   │   │   ├── style.css
│   │   │   └── app.js
│   │   ├── mobile/              Superboard Mobile Shell (light theme v1.15)
│   │   │   └── index.html       ✅ light nav + profile button + bottom-sheet
│   │   └── pages/
│   └── pwa/                     PWA Shell (no iframe) — Phase 1 ✅ Done
│       ├── index.html           App shell หลัก
│       ├── manifest.json        PWA installable
│       ├── sw.js               Service Worker / offline cache
│       ├── css/
│       │   └── app.css          Design system v1.15 (full overhaul)
│       ├── js/
│       │   ├── router.js        SPA navigation + back button
│       │   └── app.js           Token, PTR, utils, toast
│       └── pages/
│           ├── home.js          หน้าหลัก ✅ Living Dashboard + menu grid
│           ├── billing.js       ออกบิล ✅ search, items, sticky total, payment sheet
│           ├── orders.js        ออเดอร์ ✅ list + filters + status badges
│           ├── products.js      สินค้า ✅ list + search + stock display
│           ├── members.js       ลูกค้า ✅ list + search + tier badges
│           ├── more.js          เพิ่มเติม ✅ drawer menu + module links
│           ├── pos.js           ขายด่วน (Phase 2)
│           ├── chat.js          แชท (Phase 2)
│           └── autopost.js      AutoPost (Phase 2)
├── modulpos/                    POS Mobile (iframe-based, legacy)
│   ├── api/routes.py
│   └── frontend/dashboard/index.html
├── modulechat/                  Chat Module Foundation
│   ├── api/routes.py
│   └── frontend/dashboard/index.html
└── modulepost/                  AutoPost Module Foundation
    ├── api/routes.py
    └── frontend/dashboard/index.html
```
---
5. API Endpoints ทั้งหมด
POS (ครบแล้ว)
```
/api/pos/bills/*          — bills CRUD
/api/pos/products/*       — products CRUD
/api/pos/categories/*     — categories CRUD
/api/pos/members/*        — members CRUD
/api/pos/partners/*       — partners CRUD
/api/pos/affiliate/*      — affiliate CRUD
/api/pos/store/*          — store settings
/api/pos/bank/*           — bank accounts
/api/pos/receive/*        — stock receive
/api/line/*               — LINE webhook
/api/pos/line/*           — LINE settings
```
POS Mobile API
```
GET /api/pos-mobile/summary        — ยอดวันนี้, เดือน, stock ต่ำ
GET /api/pos-mobile/bills/recent   — บิลล่าสุด
GET /api/pos-mobile/products/list  — รายการสินค้า
GET /api/pos-mobile/members/list   — รายชื่อสมาชิก
```
Chat & Post Module (Foundation)
```
GET /api/chat/summary, /live-feed, /sessions
GET /api/post/summary, /posts, /queue
```
---
6. Domains & Routing
Domain	ชี้ไปที่	หมายเหตุ
`concore.viiv.me`	`/frontend`	Superboard หลัก (desktop)
`m.viiv.me`	`/superboard/mobile/`	Mobile Shell เดิม (iframe)
`*.viiv.me/pwa/*`	`/frontend/pwa/`	PWA ใหม่ (no iframe)
`*.viiv.me/modulpos/*`	`/modulpos/frontend/`	POS module เดิม
`chat.viiv.me`	`/modulechat/frontend/`	Chat module
`post.viiv.me`	`/modulepost/frontend/`	Post module
Caddyfile Paths (wildcard block)
```
handle /uploads/*    → /home/viivadmin/viiv  (no-store cache)
handle /api/*        → localhost:8000
handle /merchant/*   → modules/pos/merchant/ui/dashboard
handle /superboard/* → frontend/
handle /pwa/*        → frontend/
handle /modulpos/*   → modulpos/frontend/
handle /modulchat/*  → modulechat/frontend/
handle /modulepost/* → modulepost/frontend/
```
---
7. Strategic Decision (v1.14) — Mobile Architecture
ทำไมถึงเปลี่ยนจาก iframe เป็น PWA
iframe limitations ที่แก้ไม่ได้:
ปัญหา	ระดับ
Pull-to-refresh ทำไม่ได้เลย	Critical
iOS Safari swipe back หลุดจากแอป	Critical
Keyboard push layout พัง	Critical
URL ไม่เปลี่ยน / share ไม่ได้	High
Double scroll สับสน	High
Loading state ไม่รู้	High
Performance ช้า 2x	Medium
Capacitor/native wrap ในอนาคตทำไม่ได้	High
แผนที่เลือก: Responsive-first + Mobile exceptions
```
95% — Responsive single file
       Layout ปรับตาม screen อัตโนมัติ
       Logic/API/DB เดิมทั้งหมด
       แก้ที่เดียว work ทุก device

5%  — Mobile-specific file
       เฉพาะหน้าที่พิสูจน์แล้วว่า responsive ทำไม่ได้
       เช่น barcode scan, camera, print
```
---
8. PWA Shell Architecture (NEW v1.14)
URL: `https://concore.viiv.me/pwa/`  
Files: `/home/viivadmin/viiv/frontend/pwa/`
Key Features
```
✅ Pull-to-refresh — native (ทำงานได้เพราะไม่มี iframe)
✅ Back button — SPA router intercept
✅ URL เปลี่ยนตาม page (#home, #billing, etc.)
✅ Offline support — Service Worker cache
✅ Add to Home Screen — manifest.json
✅ No iframe — native scroll, keyboard, gestures
✅ Max width 768px — tablet support
```
Router System
```javascript
// Navigate ไปหน้าใหม่
Router.go('billing', { id: 'xxx' });

// กลับหน้าก่อน
Router.back();

// Register page
Router.register('billing', {
  title: 'ออกบิล',
  async load(params) { /* render content */ },
  destroy() { /* cleanup */ }
});
```
Token Flow (no iframe)
```
1. Parent postMessage({type:'viiv_token', token})
2. App.js รับ → เก็บใน App.token
3. ทุก API call → App.api('/api/...') ส่ง token อัตโนมัติ
4. Fallback: localStorage.getItem('viiv_token')
```
Pull-to-refresh
```
#page-container (native scroll)
  ↓ touchstart (scrollTop === 0)
  ↓ touchmove → แสดง spinner
  ↓ touchend (dy >= 70px) → dispatch 'viiv:refresh'
  ↓ แต่ละ page รับ event → reload data
```
Design System (app.css)
```css
/* Tokens */
--gold, --bg, --card, --bdr, --txt, --muted
--topbar-h: 48px
--navbar-h: 58px
--safe-bot: env(safe-area-inset-bottom)
--fs-xs/sm/md/lg/xl/h: clamp() fluid

/* Components */
.card, .hero-card, .menu-grid, .menu-btn
.list-item, .field, .btn, .btn-primary
.sticky-bar, .sheet, .tag, .nb-btn
```
---
9. Mobile POS Pages — Scope & Phase Plan
ไฟล์ทั้งหมดที่ต้อง migrate
โฟลเดอร์	ไฟล์	ขนาด	Phase	ความซับซ้อน
dashboard	main.html	15KB	1	🟢
billing	create.html	34KB	1	🔴
billing	search.html	42KB	1	🟡
billing	print.html	26KB	2	🟡
easysale	catalog.html	8KB	1	🟢
easysale	pos.html	15KB	2	🔴
orders	all.html	20KB	1	🟢
orders	payment.html	19KB	2	🟡
orders	shipping.html	31KB	2	🟡
products	all.html	5KB	1	🟢
products	create.html	17KB	2	🟡
products	manage.html	25KB	2	🟡
products	receive.html	60KB	3	🔴
members	all.html	3KB	1	🟢
affiliate	all.html	27KB	2	🟡
sales	today.html	8KB	1	🟢
finance	overview.html	10KB	1	🟢
finance	income.html	12KB	2	🟡
finance	expense.html	16KB	2	🟡
settings	store.html	95KB	3	🔴
Phase 1 — Core (2-3 สัปดาห์)
```
home.js      → dashboard + ยอดขาย + menu
billing.js   → ออกบิล (หัวใจ)
orders.js    → รายการออเดอร์
products.js  → รายการสินค้า
members.js   → รายชื่อลูกค้า
more.js      → drawer เมนูเพิ่มเติม
```
Phase 2 — Operations (2-3 สัปดาห์)
```
billing/payment  → รับชำระเงิน
billing/print    → พิมพ์ใบเสร็จ
orders/shipping  → จัดการจัดส่ง
products/create  → เพิ่มสินค้า
products/manage  → แก้ไขสินค้า
easysale         → ขายด่วน
affiliate        → Affiliate
finance          → การเงิน
```
Phase 3 — Advanced (3-4 สัปดาห์)
```
products/receive → รับสินค้า (60KB ซับซ้อนมาก)
settings/store   → ตั้งค่า (95KB — แยกเป็นหน้าย่อย)
```
billing/create components (สำคัญที่สุด)
```javascript
// Functions หลัก
fmt(), reloadMembers(), autosaveDraft()
loadData(), uiDocType(), addProduct()
renderItems(), calc(), calcChange()
save(), clearBill(), showNewMemberPopup()

// UI Sections
#billSearchInput, #billScanToggle, #billScanArea
#billItems, #billCustomer, #billMemberDrop
#billDiscount, #billVat, #billTotal
#billDocType, #billNote, #billScheduledAt
```
```
Mobile Layout (Responsive):
┌──────────────────┐
│ 🔍 ค้นหาสินค้า   │  ← ค้นหา/scan
├──────────────────┤
│ รายการสินค้า     │  ← scroll
├──────────────────┤
│ sticky: ฿150 [จ่าย]│  ← sticky bottom
└──────────────────┘
กด "จ่าย" → bottom sheet:
┌──────────────────┐
│ ลูกค้า/ส่วนลด/ยอด│
│ [เงินสด][QR][บัตร]│
│ [ออกบิล]         │
└──────────────────┘
```
---
10. Cloudflare Cache Rules
Rule	Match	Action
Bypass cache Superboard	URI contains `/superboard/`	Bypass cache
Bypass cache uploads & API	`*.viiv.me/uploads/*` OR `*.viiv.me/api/*`	Bypass cache
สำคัญ: ทั้ง `concore.viiv.me` block และ `*.viiv.me` block ต้องมี `/uploads/*` handler พร้อม `Cache-Control: no-store`
---
11. Known Rules & Issues
Rule 16 — Cloudflare Cache 404
รูปภาพใน `/uploads/` ต้องมี Cloudflare Bypass Cache rule  
`concore.viiv.me` block ต้องมี `/uploads/*` handler แยก (wildcard ไม่ครอบ)
Rule 17 — JavaScript var scope
`var` ใน `try{}` block → declare ที่ function scope บนสุด  
`print.html: var _banks=[]` ต้องอยู่นอก try block (แก้แล้ว v1.13)
Rule 18 — Caddyfile concore block
`concore.viiv.me` ต้องมี `/uploads/*` handler แยก
Rule 19 — Mobile iframe back button
`history.pushState()` + `popstate` intercept — แก้แล้ว v1.13  
modulpos ส่ง `postMessage({type:'viiv_back'})` ขึ้น shell
Rule 20 — iframe Pull-to-refresh
ทำไม่ได้เลยใน iframe — iframe กิน touch events ทั้งหมด  
→ แก้ถาวรด้วย PWA (no iframe) ใน v1.14
Rule 21 — PWA Pull-to-refresh
ต้องเช็ค `container.scrollTop === 0` ก่อน start pull  
touch listener ต้องอยู่บน `#page-container` (native scroll element)
Rule 22 — Token Sync: PWA app.js ห้าม removeItem localStorage (เหตุการณ์ 2026-04-23)
ปัญหา: `app.js Api()` เมื่อได้รับ 401 เดิมรัน `localStorage.removeItem('viiv_token')` แล้วใช้ dev token ภายใน  
→ Merchant Dashboard (ที่อ่าน localStorage โดยตรง) สูญเสีย token → ทุก API พัง 401 ทันที  
แก้แล้ว: เปลี่ยนจาก removeItem เป็น setItem(dev token) เพื่อ sync กลับ localStorage เสมอ  
ห้ามรัน `localStorage.removeItem('viiv_token')` ยกเว้น explicit logout เท่านั้น  
Rule 23 — Merchant Dashboard ต้องมี token bootstrap (เหตุการณ์ 2026-04-23)
`dashboard.html` ต้องมี dev token fallback ใน bootstrap script:  
```javascript
if(!localStorage.getItem('viiv_token')) { localStorage.setItem('viiv_token', DEV_TOKEN); }
```  
และทุก `/merchant/*` handler ใน Caddyfile ต้องมี `header Cache-Control "no-store, no-cache, must-revalidate"`  
ถ้าไม่มี: Cloudflare cache dashboard เก่า → fix ใหม่ไม่มีผล  
Rule 24 — Token Architecture ปัจจุบัน (dev) vs Production
Dev: hardcoded token `ten_1/usr_1` ใน app.js + dashboard.html (ใช้ได้ชั่วคราว)  
Production ต้องทำ: refresh token flow + httpOnly cookie หรือ centralized auth module  
ห้าม deploy hardcoded dev token ให้ลูกค้าจริงใช้ — ต้องแก้ก่อน go-live  
Rule 12-15 (จาก v1.12)
Rule 12: SPA font override → iframe isolation
Rule 13: ห้ามใช้ regex กับ HTML
Rule 14: fetch+innerHTML → timer leak
Rule 15: Git restore `f3adb9c`
---
12. RAM Usage
Process	RAM
VS Code Remote SSH (รวม extensions)	~1,150 MB
uvicorn (production)	~106 MB
Caddy	~44 MB
PostgreSQL	~28 MB
Production total (ไม่มี VS Code)	~180 MB
---
13. Blue-Green Deployment Plan
โครงสร้าง
```
/home/viivadmin/viiv/         ← Blue (production, port 8000)
/home/viivadmin/viiv-green/   ← Green (staging, port 8001)
```
Swap Script
```bash
# /home/viivadmin/swap.sh
kill $(lsof -ti:8000) 2>/dev/null && sleep 1
cd /home/viivadmin/viiv-green && source .venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 \
  > logs/uvicorn.log 2>&1 &
echo "✅ Green is now production"
```
Rollback Script
```bash
# /home/viivadmin/rollback.sh
kill $(lsof -ti:8000) 2>/dev/null && sleep 1
cd /home/viivadmin/viiv && source .venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 \
  > logs/uvicorn.log 2>&1 &
echo "✅ Rolled back to Blue"
```
ประเด็นสำคัญ
Database migration → รัน staging ก่อน ถ้า OK ค่อย production
Static files → update ได้ตลอดไม่กระทบ
Uploads → symlink ใช้ร่วมกัน: `ln -s /viiv/uploads /viiv-green/uploads`
---
14. Pending / TODO (v1.15)
#	Item	Priority
1	✅ PWA Phase 1 — home, pos, billing, orders, products, members, more	Done
2	✅ Mobile Shell — light theme nav + profile button	Done
3	✅ Order detail view — bill info + markPaid + void	Done
4	pos_line.py — Webhook + pending-uid	High
5	PWA billing — discount, VAT, doc type (invoice/receipt)	High
6	PWA orders/shipping — shipping status update	Medium
7	PWA products/create — เพิ่มสินค้าใหม่	Medium
8	PWA members — add member form	Medium
9	Blue-Green setup — สร้าง viiv-green + scripts	Medium
10	Chat Module — connect LINE webhook จริง	Medium
11	Dashboard API — ยอดแชท, Affiliate, AutoPost จริง	Medium
12	PWA Phase 2 — easysale, affiliate, finance	Medium
13	PWA Phase 3 — receive, settings	Future
14	Capacitor.js — wrap เป็น APK/IPA	Future
15	AI Chat Interface — shell สั่งงานด้วยแชท	Future
---
15. Resolved in v1.15
PWA Phase 1 Complete (2026-04-23)
✅ home.js — Living Dashboard + module cards (POS/Chat/Aff/AutoPost) + tickers
✅ pos.js — POS Hub: summary card + menu grid + recent bills
✅ billing.js — ออกบิล: product search + cart + qty control + payment sheet → API save
✅ orders.js — Order list (tabs: all/paid/pending/voided) + **bill detail view**
✅ products.js — Product list + search + stock badge (สีตามจำนวน)
✅ members.js — Member list + search + credit/PV display
✅ more.js — Navigation drawer (การขาย, สินค้า/ลูกค้า, ข้อมูลทั่วไป)
✅ app.css — Design system overhaul (fluid clamp, tokens, components)
Order Detail View (v1.15)
✅ orders.js handles params.id → detail mode
✅ Bill header: bill_no, status badge, date, staff, customer
✅ Items list with qty × price subtotal
✅ Financial summary: subtotal, discount, VAT, total, payment method
✅ markPaid action (pending → paid) via update-status API
✅ Void action with reason sheet → void API
✅ After billing.js creates bill → auto-navigate to detail (receipt)
Mobile Shell (v1.15)
✅ Light theme bottom nav (var(--card) ไม่ใช่ #1a1206)
✅ Profile avatar button top-right
✅ Profile bottom-sheet: ชื่อ/นามสกุล/เบอร์/อีเมล/เปลี่ยนรหัสผ่าน
Resolved in v1.14
✅ วิเคราะห์ข้อเสีย iframe 18 ปัญหา, เลือก PWA approach
✅ PWA shell: manifest.json, sw.js, app.css, router.js, app.js
✅ Caddy serve /pwa/ path
✅ Pull-to-refresh native, back button, viewport scale
---
16. Git Restore Points
Commit	Description
`f3adb9c`	Superboard Dashboard Live4/4 (safe point)
`ab5ec4d`	PWA shell foundation (PTR, router, design system)
`c778e1d`	PWA Phase 1 complete (all core pages)
`c91cfec`	Mobile shell light theme + profile button ← latest safe point
```bash
git log --oneline -15
git checkout f3adb9c -- frontend/superboard/pages/home.html
```
---
17. Quick Commands
```bash
# Restart server
kill $(lsof -ti:8000) 2>/dev/null && sleep 1
cd /home/viivadmin/viiv && source .venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > logs/uvicorn.log 2>&1 &
sleep 2 && tail -3 logs/uvicorn.log

# Reload Caddy
sudo systemctl reload caddy

# Check RAM
ps aux --sort=-%mem | head -8

# Test uploads
curl -I "https://concore.viiv.me/uploads/store/[file]" | grep "HTTP\|cf-cache"

# PWA URL
open https://concore.viiv.me/pwa/
```
---
18. URLs ทั้งหมด
URL	หน้า	สถานะ
`https://concore.viiv.me`	Superboard Desktop	✅ Production
`https://concore.viiv.me/pwa/`	PWA Mobile (ใหม่)	🚧 WIP
`https://m.viiv.me/superboard/mobile/index.html`	Mobile Shell เดิม (iframe)	✅ Legacy
`https://chat.viiv.me`	Chat Module	🚧 Foundation
`https://post.viiv.me`	AutoPost Module	🚧 Foundation
---
19. Architecture Vision
```
ปัจจุบัน (v1.14):
  Desktop: Superboard SPA (iframe-based)
  Mobile: PWA Shell (no iframe) ← กำลังสร้าง

อนาคตอันใกล้ (v1.15-1.20):
  PWA Mobile — full featured
  ├── POS (billing, orders, products, members)
  ├── Chat (LINE/FB realtime)
  └── AutoPost (scheduler, content)

อนาคต (v2.x):
  Capacitor.js → APK + IPA
  App Store / Play Store distribution
  Push notification จริง
  Camera, GPS, NFC access

อนาคตไกล (v3.x):
  AI Chat Interface
  "ออกบิล 3 รายการให้ลูกค้าสมชาย"
  → AI route คำสั่งไปยัง API โดยตรง
```
---
20. การ Scan Merchant Pages
ผลการ scan billing/create.html
```
ขนาด: 34KB (~1,500 บรรทัด)
Functions: fmt, reloadMembers, autosaveDraft, loadData,
           uiDocType, addProduct, renderItems, calc,
           calcChange, save, clearBill, showNewMemberPopup

UI Sections: billDocType, billSearchInput, billScanToggle,
             billScanArea, billItems, billCustomer,
             billMemberDrop, billDiscount, billDiscountType,
             billVatType, billVat, billTotal, billNote

APIs: /api/pos/bills/*, /api/pos/products/list,
      /api/pos/members/search, /api/pos/bank/list,
      /api/pos/store/settings
```
---
Project Bible v1.15 — Updated 2026-04-23  
ต่อจาก v1.14 | VIIV Development Team

## วิธีทำงานร่วมกับ Claude Code

- ก่อนแก้ไฟล์ใดๆ ให้อ่าน CLAUDE.md ก่อนเสมอ
- ใช้ virtual env: `source /home/viivadmin/viiv/.venv/bin/activate`
- ห้ามแก้ไฟล์ production โดยไม่บอกก่อน
- หลังแก้โค้ดให้ restart server ด้วย command จาก Section 2 เสมอ
- Version ปัจจุบัน: v1.15




## Context การทำงานปัจจุบัน

### Architecture จริง
- Auth หลัก: Superboard (m.viiv.me/superboard/mobile/)
- PWA (/pwa/) รับ token จาก Superboard ผ่าน postMessage
- PWA ไม่มี login หน้าตัวเอง — token มาจาก parent เสมอ

### งานที่กำลังทำ (v1.15)
- Phase 1 เสร็จแล้ว — home, pos, billing, orders (+ detail), products, members, more
- ถัดไป: billing เพิ่ม discount/VAT/doc-type, orders shipping, products/members CRUD
- ไฟล์ที่ใช้จริง: frontend/pwa/ (ไม่ใช่ app1-5.js)