VIIV CLAUDE.md
> สำหรับ Claude Code อ่านอัตโนมัติ | อย่าแก้ไฟล์นี้ยกเว้น CGO สั่ง
> Last updated: 2026-04-24 | v1.17
---
ROLE
Claude Code = Executor รับ spec จาก CGO แล้วเขียนโค้ดอย่างเดียว
ห้ามตัดสินใจ architecture เอง — ถ้าไม่แน่ใจ หยุดแล้วถาม CGO
CGO คือ Claude.ai (Pro) ที่ถือ VIIV_MASTER.md
---
MODEL POLICY (Token Budget)
งานทั่วไป (edit, debug, small feature < 100 บรรทัด) → `claude-haiku-4-5`
งาน complex logic / multi-file → `claude-sonnet-4-6`
ห้ามใช้ claude-opus ยกเว้น CGO อนุมัติเป็นลายลักษณ์อักษร
อ่านเฉพาะไฟล์ที่เกี่ยวกับ task — ห้าม read ทั้ง project
ถ้า task ต้อง read > 3 ไฟล์ → แจ้ง CGO ก่อน แบ่ง task
ห้าม loop / retry เกิน 3 ครั้งโดยไม่แจ้ง
---
STACK & PATHS
```
Runtime:  FastAPI Python 3.12 | Supabase/PostgreSQL | Caddy | Uvicorn :8000
Path:     /home/viivadmin/viiv/
Domain:   concore.viiv.me
Dashboard:/merchant/dashboard.html
JWT:      21cc8b2ff8e25e6262effb2b47b15c39fb16438525b6d041bb842a130c08be7c
Venv:     source /home/viivadmin/viiv/.venv/bin/activate
Assets:   ปัจจุบัน ?v=1164
```
---
WORKING FILES (ห้ามสับสน)
```
Backend จริง:  app/api/pos_*.py          (ไม่ใช่ modulpos/api/routes.py)
Frontend จริง: frontend/pwa/             (ไม่ใช่ modulpos/frontend/)
Legacy:        modulpos/ , modulechat/ , modulepost/  ← อย่าแตะ
```
---
RESTART SERVER
```bash
kill $(lsof -ti:8000) 2>/dev/null && sleep 1
cd /home/viivadmin/viiv && source .venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > logs/uvicorn.log 2>&1 &
sleep 2 && tail -3 logs/uvicorn.log
```
RELOAD CADDY
```bash
sudo systemctl reload caddy
```
---
CRITICAL RULES (อ่านก่อนแตะโค้ดทุกครั้ง)
Rule 22 — ห้าม `localStorage.removeItem('viiv_token')` ยกเว้น explicit logout  
→ ถ้า 401 ให้ setItem(dev token) แทน ไม่ใช่ removeItem
Rule 23 — dashboard.html ต้องมี dev token bootstrap:
```javascript
if(!localStorage.getItem('viiv_token')) { localStorage.setItem('viiv_token', DEV_TOKEN); }
```
และ `/merchant/*` handler ใน Caddyfile ต้องมี `Cache-Control: no-store, no-cache, must-revalidate`
Rule 24 — Dev token `ten_1/usr_1` ใช้ได้ชั่วคราวเท่านั้น  
→ ห้าม deploy hardcoded token ให้ลูกค้าจริงก่อน production auth flow พร้อม
Rule 25 — Field names ที่ถูกต้อง (ห้ามใช้ชื่อเก่า):
```
vat         ✅  (ไม่ใช่ vat_type)
min_alert   ✅  (ไม่ใช่ min_stock_alert / min_stock)
stock_back  ✅  คลังหลังร้าน
track_stock ✅  boolean
pay_method  ✅  ใน bills (ไม่ใช่ payment_method)
category    ✅  ใน products (ไม่ใช่ category_id)
```
Rule 16-21 — ดู VIIV_MASTER.md Section [D] Known Rules
---
WORKFLOW
อ่าน CLAUDE.md ก่อนทุก session (อัตโนมัติ)
รับ spec จาก CGO → implement
หลังแก้โค้ด → restart server เสมอ
ทำ task เสร็จ → อัปเดต VIIV_MASTER.md Section [E] Progress
ห้ามแก้ production โดยไม่บอก CGO ก่อน
END OF SESSION
เมื่อ CGO สั่ง "สรุปวันนี้" ให้รัน:
```bash
# เพิ่มสรุปงานวันนี้เข้า VIIV_MASTER.md Section [E]
# format: [YYYY-MM-DD vX.XX] รายการที่ทำ + ไฟล์ที่แก้ + สถานะ
```
---
> สำหรับรายละเอียดทั้งหมด → อ่าน VIIV_MASTER.md

# Model: haiku-4-5 default / sonnet-4-6 complex / ไม่แน่ใจ → ดู MASTER.md

---

## DB RULES — Green Development

Green (port 9000) ใช้ DB เดียวกับ Blue แต่มีกฎเข้มงวด:

### ✅ Green ทำได้
- CREATE TABLE ที่ขึ้นต้นด้วย chat_* หรือ autopost_* เท่านั้น
- INSERT, UPDATE, SELECT ใน chat_* และ autopost_* tables
- SELECT (อ่านอย่างเดียว) จาก tables เดิมทุกตัว

### ❌ Green ห้ามทำเด็ดขาด
- DROP TABLE ทุกกรณี
- TRUNCATE ทุกกรณี
- ALTER COLUMN ทุกกรณี
- RENAME TABLE หรือ RENAME COLUMN ทุกกรณี
- INSERT, UPDATE, DELETE ใน tables เดิม (bills, members, tenants, products, tenant_staff, viiv_accounts ฯลฯ)

### เหตุผล
DB เดียวกัน Blue+Green — ละเมิดกฎนี้ = ข้อมูล production เสียหาย
Backup มีอยู่ แต่ restore = downtime — ป้องกันดีกว่าแก้