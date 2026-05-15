# VIIV STATE — Runtime Snapshot
> Version: **v3.6** | Updated: 2026-05-15
> ⛔ AI/Claude Code ห้ามแก้ไฟล์นี้โดยตรง — user copy paste manual

═══════════════════════════════════════════════════════════════
CURRENT STATE — 2026-05-15 (post Phase B/C/D + LINE incident fix)
═══════════════════════════════════════════════════════════════

## Active services
PRODUCTION : test7.viiv.me     → :8000  ✅ (restarted 2026-05-15 evening)
DEV/STAGE  : dev7.viiv.me      → :9000  ✅ (restarted 2026-05-15 evening)
ADMIN      : concore.viiv.me   → :8000  ✅
LANDING    : viiv.me           → :8000  ✅ (compliance + soon /payment)

Modules running:
  modulechat   :8003  ✅ (LINE Official API — VERIFIED working)
  moduleai     :8002  ✅ (gpt-4.1-nano)
  app          :8000 + :9000

Modules DORMANT:
  modulepool   — code retained, refactor target Phase API.6

Modules ARCHIVED (sandbox, see MASTER [Z]):
  modulefbchat, modulecookie, docker/mautrix, android/Capacitor

## LINE OA Status (verified 2026-05-15 20:42)
  ten_1     → @749wyqfy  (iAM_Food production)   ✅ tested working
  test_dev  → 284uegop   (dev7 testing OA)        ✅ unique, no conflict

## Tenants: 11 ร้าน (unchanged)
  - ten_1 (test7, pkg_pro, active) — PRODUCTION
  - test_dev (dev7, pkg_pro, active, trial) — STAGING
  - + 9 ร้าน pending

## Git state
branch: main
HEAD: c188a51 (Phase C PWA bottom sheet)
Pending commits: Phase B.5 enlarge (not yet committed)
Pending push: MASTER v6.3 + STATE v3.6 (this update)

## Compliance Foundation Live (Phase API.0 ✅)
https://viiv.me/privacy        ✅ 200
https://viiv.me/terms          ✅ 200
https://viiv.me/data-deletion  ✅ 200
https://viiv.me/               ✅ 200

═══════════════════════════════════════════════════════════════
SESSION 2026-05-15 — Phase B/C/D + LINE incident
═══════════════════════════════════════════════════════════════

Duration: ~all-day
Outcome: 
  ✅ Bank popup landed (superboard + PWA)
  ✅ MASTER v6.3 clean rewrite
  ✅ Phase D /payment in design (spec ready)
  ✅ LINE OA production fix (7-8 day silent outage discovered + resolved)

## Work completed today

### Phase B — Superboard Bank Detail Modal ✅
Files: frontend/superboard/pages/topup.html
Pattern: center modal, 780px desktop, payment methods grid

Commits:
- 30f292e  feat(topup): add bank detail modal HTML+CSS (no JS yet)
- c8e32be  feat(topup): wire bank card click → detail popup with copy+select

Verified: ✅ All 8 functional + 4 visual + 3 edge case tests passed

### Phase B.5 — Enlarged superboard modal + payment methods 🔲
Files: frontend/superboard/pages/topup.html
Changes:
  - Modal width 560px → 780px desktop
  - QR enlarged: 240px → 320px
  - Payment grid: 6 logos (Visa/MC/JCB/PromptPay/TrueMoney/ShopeePay)
  - All payment logos disabled (opacity 0.45 + "เร็วๆ นี้" badge)
  - Backdrop blur 4px → 6px
  - Mobile responsive 6→3 column grid
  
Status: Spec ready, implementation pending verify
⚠️ Not yet committed

### Phase C — PWA Bank Bottom Sheet ✅
Files: frontend/pwa/pages/topup.js
Pattern: bottom sheet (PWA convention — profile-modal style)
  - Slide-up animation from bottom
  - Drag handle pill + ESC + backdrop close
  - Safe-area aware (max-height 92dvh)
  - z-index 500 (between store-sheet 200 and shop-add 9000)
  - Function prefix: tuPwa* (PWA convention)
  - Inline style strings (no CSS class system — PWA convention)
  - 3-column payment grid (vs 6-column desktop)

Commit:
- c188a51  feat(pwa-topup): port bank detail popup as bottom sheet

Verified: ✅ Visual + interaction + animation + PWA-specific tests passed

### Phase D — /payment public page 🔲 IN PROGRESS
Scope:
  D.1: GET /api/public/payment-info (no auth, 1 default account)
       File: app/api/public_info.py (new)
  D.2: frontend/payment.html (brand consistent, Noto Thai fonts)
  D.3: Caddyfile changes — 2 blocks:
       - handle /payment { rewrite /payment.html + no-store cache }
       - handle /uploads/* { file_server + cache 1d } on viiv.me
  D.4: Landing CTA button "วิธีชำระเงิน" (green) + footer link

Status: Spec ready, recon complete
Blockers: 
  - B1: viiv.me ต้องเพิ่ม /uploads/* handler (QR image accessibility)
  - B2: is_default = false ทุก row → fallback sort_order ASC
Next: User confirm + run spec D.1 → D.2 → D.3 → D.4

### MASTER v6.3 — Clean rewrite ✅
- ลด ~2000 → ~1640 lines (-20%)
- Consolidated Rules 1-405 by category
- Removed paradigm-specific decisions (D85-D92 Patchright, D99-D119 mautrix)
- Condensed [Z] Decommissioned section (5 paradigms × 1-line summary)
- Added Law 14 (API-First) + Rules 406-411 (Public Pages)
- Added D159-D165 (bank popup + /payment decisions)

═══════════════════════════════════════════════════════════════
🚨 INCIDENT 2026-05-15 — LINE OA Production Bot Down
═══════════════════════════════════════════════════════════════

## Summary
Production LINE OA (iAM_Food = @749wyqfy) bot ไม่ตอบ silent outage
ระยะเวลา ~7-8 วัน (07 พ.ค. → 14 พ.ค. ระหว่างนั้นไม่ทราบ)
CGO discovered 14 พ.ค. (ทดสอบ — bot ไม่ตอบ)
Resolved 2026-05-15 20:42 (verified with test message "ทดสอบ5")

## Root cause
`line_settings.oa_id` ของ `ten_1` ใน DB ถูกตั้งผิดเป็น `284uegop` (OA ของ
dev7) แทนที่จะเป็น `@749wyqfy` (OA ของ iAM_Food production)

ส่งผล:
1. iAM_Food OA ส่ง webhook → /api/line/webhook?tenant=ten_1
2. Backend resolve tenant จาก signature → ต้องการ oa_id = @749wyqfy
3. DB return 0 rows (เพราะ ten_1.oa_id = 284uegop)
4. Drop webhook event เงียบ ๆ — ไม่ save inbound + ไม่ AI reply

## Timeline
- ก่อน 7 พ.ค.    : ทำงานปกติ
- 7 พ.ค. 07:45  : last successful reply ("สวัสดีค่ะ มีอะไรให้ช่วยค่ะ?")
- 7-14 พ.ค.     : silent outage (ลูกค้าทักไม่ได้รับตอบ)
                  อาจเกิดช่วง Phase Z paradigm cleanup หรือ clone tenant test
- 14 พ.ค.       : CGO discover bot ไม่ตอบ
- 15 พ.ค. (วัน): diagnose, identify, fix
- 15 พ.ค. 20:42: verified working with "ทดสอบ5"

## Fix applied
```sql
UPDATE line_settings 
SET oa_id = '@749wyqfy' 
WHERE tenant_id = 'ten_1';
```

+ Restart uvicorn :8000 (clear _subdomain_tenant_cache per Rule 68)
+ Restart uvicorn :9000 (same fix for dev)

## Verification
✅ DB state correct: ten_1=@749wyqfy, test_dev=284uegop (unique)
✅ Process restart successful (both :8000 and :9000 = 200)
✅ E2E test: inbound "ทดสอบ5" → AI reply "สวัสดีค่ะ ต้องการความช่วยเหลืออะไรคะ?"
✅ Chat Dashboard UI updated real-time

## Tech debt added — Preventive Measures (proposed Rules 412-413 for MASTER)

```
412 oa_id uniqueness invariant:
    line_settings.oa_id ต้อง UNIQUE per active tenant
    ห้าม 2+ tenants ใช้ oa_id เดียวกัน (ยกเว้น NULL)
    Future: add UNIQUE constraint via Dashboard
    CREATE UNIQUE INDEX line_settings_oa_id_active_uniq
      ON line_settings (oa_id) WHERE oa_id IS NOT NULL;

413 Credentials change ต้อง restart process:
    หลัง update line_settings ต้อง restart uvicorn ที่ port ตรงกัน
    _subdomain_tenant_cache + tenant_cache เป็น process-level (Rule 68)
    ไม่ใช่แค่ subdomain change — credentials change ก็กระทบ cache
```

## Monitoring gap discovered
❌ ไม่มี alerting เมื่อ bot reply rate = 0
❌ ไม่มี health check ที่ตรวจ ai_token_log activity
❌ ไม่มี integrity check ที่ตรวจ oa_id uniqueness

Future improvements (priority depends on user growth):
- Cronjob ตรวจ ai_token_log ของแต่ละ tenant ในรอบ 24 ชม.
- LINE OA notify owner ถ้า > 24 ชม. ไม่มี AI reply activity
- DB constraint partial unique index บน oa_id

═══════════════════════════════════════════════════════════════
CGO ACTIONS REQUIRED (priority order)
═══════════════════════════════════════════════════════════════

## 🔴 NOW (วันนี้/พรุ่งนี้)

P0  Commit MASTER v6.3 + STATE v3.6
    cd /home/viivadmin/viiv
    # Replace VIIV_MASTER.md with v6.3 (downloaded from chat)
    # Replace VIIV_STATE.md with v3.6 (downloaded from chat)
    git add VIIV_MASTER.md VIIV_STATE.md
    git commit -m "docs: MASTER v6.3 + STATE v3.6
    
    - Clean rewrite (~2000 → ~1640 lines)
    - Add Phase B/C/D bank popup + /payment
    - Add Law 14 API-First, Rules 406-411
    - INCIDENT 2026-05-15 LINE OA production fix"
    git push origin main

P1  NodeMaven credential rotation (D145, security debt from Phase Z)
    1. เปิด https://app.nodemaven.com
    2. Login → Account → API Credentials
    3. Click "Rotate" / "Regenerate"
    ⚠️ ยัง pending จาก STATE v3.5

P2  Complete Phase B.5 (enlarge superboard modal)
    Spec อยู่ใน chat ก่อนหน้า — สั่ง Claude Code
    Verify → commit ต่อจาก c8e32be

P3  Complete Phase D (/payment public page)
    D.1 → D.2 → D.3 → D.4 phased
    Spec อยู่ใน chat ก่อนหน้า

## 🟡 ภายในสัปดาห์ (Phase API preparation)

P4  Email provider decision (privacy@/support@viiv.me)
    Required ก่อน Meta/Google App Review submission
    Options: Google Workspace (~฿200/u) / Zoho (~฿35/u) / FastMail (~฿100/u)

P5  Phase API.1 spec drafting
    - data_deletion_requests table schema
    - POST /api/data-deletion/facebook callback endpoint
    - /data-deletion/status?code=xxx page
    - tenant_integrations table

## 🟡 ~2026-05-28 (2 สัปดาห์)

P6  Cleanup backups ถ้า production stable
    sudo rm /etc/caddy/Caddyfile.bak.20260514-*
    rm /home/viivadmin/viiv/.env.bak.20260514-*
    rm -rf /tmp/viiv-bak-files-20260514/
    rm /tmp/z*-*.txt
    rm /home/viivadmin/viiv/frontend/index.html.bak.20260514-*
    rm /home/viivadmin/viiv/frontend/compliance/style.css.bak.20260514-*
    # + Caddyfile backups จาก Phase D ถ้าทำเสร็จและ stable

## 🟢 ~2026-06-14 (1 เดือน)

P7  รัน DDL DROP via Supabase Dashboard
    1. เปิด Supabase Dashboard → SQL Editor
    2. Copy SQL จาก sandbox/dashboard-sql-queue-20260514.sql
    3. Uncomment DROP statements
    4. Execute
    Tables: public.fb_sessions + public.fb_audit_log

P8  (Optional) Add UNIQUE constraint บน line_settings.oa_id
    CREATE UNIQUE INDEX line_settings_oa_id_active_uniq
      ON line_settings (oa_id) WHERE oa_id IS NOT NULL;
    via Dashboard (Rule 308)
    
    ป้องกัน incident แบบ 2026-05-15 ไม่ให้เกิดอีก

═══════════════════════════════════════════════════════════════
NEXT SESSION CANDIDATES
═══════════════════════════════════════════════════════════════

## P1 — Complete Phase B.5 + Phase D
Spec อยู่ใน chat ก่อนหน้าครบถ้วน
Effort: 1-2 sessions
Trigger: ทันที (ไม่ต้องรอ)

## P2 — Phase API.1 implementation (highest priority for Phase API)
Scope:
- DB: data_deletion_requests + tenant_integrations (DDL via Dashboard)
- API: POST /api/data-deletion/facebook callback
- API: OAuth flow (start/callback/refresh per platform)
- Frontend: /data-deletion/status?code=xxx page
- Tests: validate FB signed_request + token storage

Effort: 2-3 sessions
Trigger: รอ CGO ตัดสิน email + decide platform priority

## P3 — Phase API.2 FB Graph API + Messenger
Effort: 3-5 sessions + App Review wait (2-8 สัปดาห์)
Trigger: รอ Phase API.1 + compliance live (DONE) + email live

## P4 — Phase API.3-5 (TikTok/IG/YT/Shopee/Lazada)
Each: 1-2 sessions + App Review per platform

## P5 — Phase API.6 modulepool refactor → API rate-limit pool
Reuse: state machine, scoring formula, audit, manager
Effort: 2-3 sessions
Trigger: when API platforms มี rate limit ที่ต้อง manage

## P6 — Operational hardening (LINE OA monitoring)
- Cron + alert สำหรับ tenant ที่ silent > 24h
- Health endpoint integrity check
- DB UNIQUE constraint enforcement
Effort: 1 session
Trigger: optional แต่แนะนำ หลัง P1-P5 stable

═══════════════════════════════════════════════════════════════
NEXT TURN HANDOFF
═══════════════════════════════════════════════════════════════

## ก่อนเริ่ม session ใหม่

1. Copy VIIV_MASTER.md (v6.3) + VIIV_STATE.md (v3.6) → วางใน AI แชท
2. ตรวจ Claude Code RAM:
   ps aux | grep claude | grep -v grep
   kill instance เก่าถ้ามี

## ตรวจสถานะ infrastructure

```bash
# Active services
curl -s http://localhost:8002/health  # moduleai
curl -s http://localhost:8003/health  # modulechat

# Production health
curl -sS -o /dev/null -w "viiv.me:        %{http_code}\n" https://viiv.me/
curl -sS -o /dev/null -w "privacy:        %{http_code}\n" https://viiv.me/privacy
curl -sS -o /dev/null -w "terms:          %{http_code}\n" https://viiv.me/terms
curl -sS -o /dev/null -w "data-deletion:  %{http_code}\n" https://viiv.me/data-deletion
curl -sS -o /dev/null -w "test7:          %{http_code}\n" https://test7.viiv.me/api/platform/health
curl -sS -o /dev/null -w "dev7:           %{http_code}\n" https://dev7.viiv.me/api/platform/health

# LINE OA health (post-incident — should be working)
# Send test message to iAM_Food OA → check DB
psql postgresql://postgres:viiv_secure_123@10.1.0.3:5434/postgres -c \
  "SELECT id, direction, message_type, LEFT(content,40) AS preview, created_at
   FROM chat_messages 
   WHERE created_at > NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC LIMIT 10;"

# Verify oa_id uniqueness (post-fix)
psql postgresql://postgres:viiv_secure_123@10.1.0.3:5434/postgres -c \
  "SELECT tenant_id, oa_id FROM line_settings ORDER BY tenant_id;"
# Expected:
#  ten_1     | @749wyqfy
#  test_dev  | 284uegop
# Both unique ≠ each other
```

## Quick reference สำหรับ Phase API

- LINE Messaging API: https://developers.line.biz/en/reference/messaging-api/
- FB Graph API + Messenger: https://developers.facebook.com/docs/messenger-platform
- IG Graph API: https://developers.facebook.com/docs/instagram-api
- TikTok for Business: https://business-api.tiktok.com/portal/docs
- YouTube Data API: https://developers.google.com/youtube/v3
- Google API Services User Data Policy: https://developers.google.com/terms/api-services-user-data-policy
- Shopee Open: https://open.shopee.com/
- Lazada Open: https://open.lazada.com/

═══════════════════════════════════════════════════════════════
END OF STATE v3.6
═══════════════════════════════════════════════════════════════
