# VIIV STATE — Runtime Snapshot
> Version: **v3.5** | Updated: 2026-05-14
> ⛔ AI/Claude Code ห้ามแก้ไฟล์นี้โดยตรง — user copy paste manual

═══════════════════════════════════════════════════════════════
CURRENT STATE — 2026-05-14 (post Phase API.0 complete)
═══════════════════════════════════════════════════════════════

## Active services
PRODUCTION : test7.viiv.me     → :8000  ← ลูกค้าใช้
DEV/STAGE  : dev7.viiv.me      → :9000  ← เรา dev
ADMIN      : concore.viiv.me   → :8000
LANDING    : viiv.me           → :8000  ← Compliance pages + footer legal links

Modules running:
  modulechat    :8003  (LINE chat — Official API ✅)
  moduleai      :8002  (gpt-4.1-nano)
  app           :8000 + :9000

Modules archived (Phase Z.B):
  modulefbchat, modulecookie, docker/mautrix, android, capacitor
  → sandbox/archive-20260514-paradigm-pivot.tar.gz (423K, 368 files)

Module DORMANT:
  modulepool/   — code kept, process stopped (refactor target: Phase API.6)

Tenants: 11 ร้าน (unchanged)
LINE OA: iAM_Food (@749wyqfy) ✅

## Compliance Foundation Live (Phase API.0 ✅)
https://viiv.me/privacy        — นโยบายความเป็นส่วนตัว (TH+EN) ✅ 200
https://viiv.me/terms          — เงื่อนไขการใช้บริการ (TH+EN) ✅ 200
https://viiv.me/data-deletion  — การลบข้อมูล (TH+EN) ✅ 200
https://viiv.me/               — landing + footer legal links ✅ 200

## Git state
branch: main
HEAD:   <NEW commit> fix(compliance): Thai font + Cloudflare cache + final polish
Tags:   pre-phase-z-paradigm-cleanup
Synced with origin/main ✅

═══════════════════════════════════════════════════════════════
SESSION 2026-05-14 — Phase API.0 complete (compliance foundation)
═══════════════════════════════════════════════════════════════

Duration: ~6 ชั่วโมง (afternoon)
Outcome: ✅ Compliance pages live + landing rebrand + Phase Z verify

## Phases completed today

✅ Phase Z verify (morning carryover)
   • Archive 423K, 368 files intact
   • 4 dead paths confirmed gone (modulefbchat/modulecookie/docker-mautrix/android)
   • Production unchanged

✅ Phase API.0 — Compliance Foundation
   • F.1 — Draft 3 compliance pages (privacy/terms/data-deletion) TH+EN
   • F.2 — Deploy v1 — commit 1795182
   • F.3 — Content review v2 — privacy + terms feedback
     - Google API Services User Data Policy references
     - AI §4.1 dedicated section
     - Force Majeure §8.1 (terms)
     - IP/privacy violation §4 (terms)
     - Facebook Data Deletion Callback mention
   • F.4 — Rebrand "VIIV" → "ViiV Platform" — commit 565403c
     - 3 compliance pages: title + brand + footer (9 patches)
     - Landing: title + nav + footer (3 patches)
   • F.5 — Footer legal links on landing — commit ba4447d
     - Privacy/Terms/Data Deletion links discoverable
     - CSS .f-legal + .f-sep styling
   • F.6 — Mobile responsive refinements — commit ba4447d
     - nav: letter-spacing 4px → 1.5px on mobile
     - footer: column layout + center align
   • F.7 — Thai font fix — commit <NEW>
     - Fraunces ไม่มี Thai glyphs → Noto Serif Thai
     - IBM Plex Sans Thai → Noto Sans Thai
     - Cloudflare cache control for /compliance/*

## Decisions added (D153-D158)
D153  Compliance scope = 3 pages, viiv.me, TH+EN toggle
D154  Thai fonts = Noto Sans Thai + Noto Serif Thai (AI-decided)
D155  Platform mention order: FB → TikTok → IG → LINE → YT → Google
D156  AI provider disclosure = generic + examples
D157  Cloudflare cache strategy = no-store for compliance
D158  Brand rebrand metadata-only (preserve body inline "ViiV")

## Rules added (399-405)
399  Compliance pages = required for ANY Platform App Review
400  Cloudflare cache control for compliance (no-store)
401  Thai font rendering standard (Noto family)
402  Platform mention consistency (FB → TikTok → IG → LINE → YT → Google)
403  Data Deletion methods per-platform dedicated
404  AI provider disclosure pattern (generic + examples)
405  Mobile responsive standard (375px test breakpoint)

## Tech debt resolved
✅ No Privacy Policy URL (Phase API.0 blocker for App Review)
✅ No Terms of Service URL
✅ No Data Deletion mechanism documented
✅ Thai font rendering broken (Fraunces fallback)
✅ Compliance pages not discoverable from landing
✅ "VIIV" → "ViiV Platform" brand consistency
✅ Mobile responsive (375px verified on real device)

## Tech debt added/pending

⚠️ P0 — NodeMaven credential rotation (D145)
   Action: https://app.nodemaven.com → rotate
   Status: pending CGO manual action

⚠️ P1 — MASTER v6.0 + v6.1 commit
   Status: pending CGO copy paste manual
   Files ready: /tmp/VIIV_STATE-v3.4-draft.md + new v6.1 append

⚠️ P2 — Email setup (privacy@/support@viiv.me)
   Provider TBD (Google Workspace / Zoho / FastMail)
   Required before Meta App Review submission

⚠️ P3 — Cleanup backups (~2026-05-28 if stable)
   /etc/caddy/Caddyfile.bak.20260514-phase-z
   /etc/caddy/Caddyfile.bak.20260514-* (compliance routes)
   .env.bak.20260514-phase-z
   /tmp/viiv-bak-files-20260514/
   /tmp/z-*-before.txt
   frontend/index.html.bak.20260514-*
   frontend/compliance/style.css.bak.20260514-*

⚠️ P4 — DB DROP (~2026-06-14)
   sandbox/dashboard-sql-queue-20260514.sql via Supabase Dashboard
   Tables: fb_sessions + fb_audit_log

⚠️ Phase API.1 pending implementation
   - Per-platform module skeleton (OAuth + tenant_integrations DB)
   - Data Deletion callback endpoint (POST /api/data-deletion/facebook)
   - /data-deletion/status?code=xxx page
   - data_deletion_requests table

⚠️ Cloudflare manual purge needed when next compliance update
   Pattern: Cloudflare Dashboard → viiv.me → Caching → Custom Purge URL
   Auto: เพราะ Caddyfile no-store rule แล้ว — purge needed only first time

═══════════════════════════════════════════════════════════════
CGO ACTIONS REQUIRED (priority order)
═══════════════════════════════════════════════════════════════

## 🔴 NOW (วันนี้)

P0  NodeMaven credential rotation (D145, security)
    1. เปิด https://app.nodemaven.com
    2. Login → Account → API Credentials
    3. Click "Rotate" / "Regenerate"

P1  Apply MASTER v6.0 + v6.1 append blocks
    1. Copy v6.0 append (ที่ /tmp/MASTER-v6.0-append.md เดิม) → ต่อท้าย MASTER.md
    2. Copy v6.1 append (ที่ /tmp/VIIV_MASTER_v6.1_append.md) → ต่อท้าย MASTER.md
    3. แก้ header version: 5.1 → 6.1
    4. แก้ Updated date: 2026-05-14

P2  Apply STATE v3.5 (ไฟล์นี้)
    cp /tmp/VIIV_STATE-v3.5.md /home/viivadmin/viiv/VIIV_STATE.md
    หรือ copy paste manual ทับ VIIV_STATE.md เดิม

P3  Commit MASTER + STATE
    cd /home/viivadmin/viiv
    git add VIIV_MASTER.md VIIV_STATE.md
    git commit -m "docs: MASTER v6.1 + STATE v3.5 — Phase API.0 complete"
    git push origin main

## 🟡 ภายในสัปดาห์ (Phase API.1 preparation)

P4  ตัดสิน Email provider (privacy@/support@viiv.me)
    - Google Workspace (~฿200/user/เดือน) — integrated with Gmail/Calendar
    - Zoho Mail (~฿35/user/เดือน หรือ free tier) — basic but cheap
    - FastMail (~฿100/user/เดือน) — privacy-focused

P5  DNS MX records setup ตาม provider ที่เลือก

P6  Phase API.1 spec drafting (AI ทำได้)
    - data_deletion_requests table schema
    - POST /api/data-deletion/facebook callback endpoint
    - /data-deletion/status?code=xxx page

## 🟡 ~2026-05-28 (2 สัปดาห์)

P7  Cleanup backups ถ้า production stable
    sudo rm /etc/caddy/Caddyfile.bak.20260514-*
    rm /home/viivadmin/viiv/.env.bak.20260514-*
    rm -rf /tmp/viiv-bak-files-20260514/
    rm /tmp/z0-discarded-diff.txt
    rm /tmp/z-processes-before.txt
    rm /tmp/z-docker-before.txt
    rm /home/viivadmin/viiv/frontend/index.html.bak.20260514-*
    rm /home/viivadmin/viiv/frontend/compliance/style.css.bak.20260514-*

## 🟢 ~2026-06-14 (1 เดือน)

P8  รัน DDL DROP via Supabase Dashboard
    1. เปิด Supabase Dashboard → SQL Editor
    2. Copy SQL จาก sandbox/dashboard-sql-queue-20260514.sql
    3. Uncomment DROP statements
    4. Execute
    Tables: public.fb_sessions + public.fb_audit_log

═══════════════════════════════════════════════════════════════
NEXT SESSION CANDIDATES
═══════════════════════════════════════════════════════════════

## P1 — Phase API.1 implementation (highest priority)

Scope:
- DB: data_deletion_requests table (DDL via Dashboard, Rule 308)
- DB: tenant_integrations table (OAuth tokens, encrypted)
- API: POST /api/data-deletion/facebook callback endpoint
- API: OAuth flow (start/callback/refresh per platform)
- Frontend: /data-deletion/status?code=xxx page
- Tests: validate FB signed_request + token storage

Effort: 2-3 sessions
Trigger: รอ CGO ตัดสิน email + decide platform priority

## P2 — Phase API.2 FB Graph API + Messenger Platform

Scope:
- Page subscription webhook
- Messenger Platform Send API
- Migrate IHeal Thy POC → Graph API
- App Review submission

Effort: 3-5 sessions + App Review wait time (2-8 สัปดาห์)
Trigger: รอ Phase API.1 + compliance live (DONE) + email live

## P3 — Phase API.3-5 Additional platforms

Each platform: 1-2 sessions + App Review per platform
- TikTok (priority — strict review)
- Instagram (uses Meta credentials, may piggyback Phase API.2)
- LINE (already live, may enhance)
- YouTube + Google
- Shopee + Lazada (commerce specific)

## P4 — Phase API.6 modulepool refactor

Scope: refactor session pool → API rate-limit pool
Reuse: state machine, scoring formula, audit pattern, manager
Effort: 2-3 sessions
Trigger: when API platforms มี rate limit ที่ต้อง manage

═══════════════════════════════════════════════════════════════
NEXT TURN HANDOFF
═══════════════════════════════════════════════════════════════

## ก่อนเริ่ม session ใหม่

1. Copy VIIV_MASTER.md (v6.1) + VIIV_STATE.md (v3.5) → วางใน AI แชท
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

# Compliance assets
curl -sI https://viiv.me/compliance/style.css | grep -iE "cf-cache-status|cache-control"
# expect: cache-control: no-store (per Rule 400)

# Verify archived stuff gone (Phase Z)
ls /home/viivadmin/viiv/modulefbchat 2>&1 | grep "No such" && echo "✅ archived"
ls /home/viivadmin/viiv/modulecookie 2>&1 | grep "No such" && echo "✅ archived"
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
END OF STATE v3.5
═══════════════════════════════════════════════════════════════
