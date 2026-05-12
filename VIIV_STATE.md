# VIIV_STATE.md
# Date: 2026-05-12 (late evening)
# Last session: Phase F.B complete — Browser Sandbox paradigm operational

---

## 🎯 Current Position

**Priority TOP:** Phase F continues — Cookie Module (Browser Sandbox paradigm)
**Next sub-phase:** F.C — Cookie Extraction + E2E Encryption

**Paradigm evolution (summary):**
- Phase B (Capacitor WebView) → RETIRED (httpOnly + FB anti-bot)
- Cookie-Editor paradigm (planned F.0-F.5 ใน v3.2 state) → SUPERSEDED before implementation
- **Current paradigm:** Browser Sandbox (Firefox container + Squid broker + Caddy + FastAPI orchestrator)

**Why superseded:** Customer install Firefox+Cookie-Editor was rated "hard" UX during planning. Browser Sandbox paradigm makes customer experience "tap button → login → done" with no installation.

---

## ✅ What's Working (don't touch)

- **APK Capacitor wrapper** (Phase A) — `viiv-debug-v4.apk` at `/home/viivadmin/viiv/uploads/apk/`
- **PWA at dev7.viiv.me/pwa/** — APK loads from network via `server.url`
- **Login + cross-subdomain** — works inside APK (B.4.2 fixed)
- **mautrix-meta stack** — Synapse:8008 + mautrix:8009 + modulefbchat:8006 (proven with manual cookies)
- **Pool architecture** — modulepool:8010 ready, slots allocated
- **AI replies LINE Messenger** — modulechat + moduleai working
- **Backend FB endpoint** — `/api/fbchat/connect` (D.0.2 commit `b9bb72a`) — F.C will integrate
- **modulecookie service** ⭐ NEW (F.B, commit 5123b00)
  - FastAPI on 127.0.0.1:8005
  - Endpoints: POST/DELETE/GET /cookie/session/* + GET /cookie/_verify
  - JWT auth + HMAC-SHA256 signed cookies + SessionManager + auto-cleanup
- **Browser sandbox infrastructure** ⭐ NEW (F.A + F.A.1)
  - Docker network `viiv-cookie-sandbox` (172.30.0.0/16)
  - Firefox + Squid sidecar pattern verified (290 + 14 MB RAM/session)
  - NodeMaven Thailand proxy (sticky per-session, credential hidden from Firefox)
  - Mobile UX (390x844 + iPhone UA → m.facebook.com)
  - Caddy: dev7.viiv.me/api/cookie/* + /browser/* (forward_auth protected)

---

## 🔴 What's Broken / Retired

- **`frontend/pwa/pages/facebook.js`** — WebView paradigm dead, ~600+ lines to refactor in F.D
- **Capacitor InAppBrowser plugin** — keep in package.json but unused
- **Cookie-Editor paradigm artifacts** — never implemented (skipped F.0-F.5 of v3.2 plan)
- **B.4.x debug instrumentation** — _logDebug, inline-log strip — remove in F.D cleanup phase

---

## 🗂️ Critical File Paths