# modulefb — Facebook Inbox Assistant

## Purpose

Browser automation infrastructure for VIIV customers who authorize
Facebook integration. The customer logs in to their own Facebook
account once; modulefb stores the session (encrypted), monitors DMs
and comments, and lets the customer's AI assistant respond on their
behalf — like a virtual assistant the customer hired.

The customer can pause, edit, or disconnect at any time.

## Customer authorization model

- Customer authorizes their **own** Facebook account
- VIIV acts on the customer's behalf, never as a third party
- Session data is AES-encrypted at rest
- Audit log records every action for customer review

## Module layout

```
modulefb/
├── main.py              FastAPI app + lifespan
├── browser/
│   ├── pool.py          BrowserPool (Playwright, resource-bounded)
│   ├── session.py       FBSessionManager (DB ↔ live context)
│   └── crypto.py        Fernet encrypt/decrypt for session storage
├── api/                 (Phase 3+ — auth endpoints)
├── workers/             (Phase 5+ — DM listener, comment poller)
└── extractors/          (Phase 5+ — message parsers, reply sender)
```

## Port

`8005` — process started via uvicorn on the dev server.

## Phase status

- Phase 0: environment verified (RAM, disk, Playwright probe)
- Phase 1: DB schema + skeleton + health endpoint ← **current**
- Phase 2: BrowserPool + SessionManager + crypto helper ← **current**
- Phase 3+: auth API, frontend, listeners, reply (future)

## Environment variables

- `FB_SESSION_ENCRYPTION_KEY` — Fernet key for session encryption
  (generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`)

## Architecture notes

- **Single Chromium binary** shared across customers (low memory)
- **Per-customer browser context** (data isolation between tenants)
- **Persistent profile** at `/uploads/fb_profiles/{tenant_id}/`
- **Idle eviction** after 30 minutes inactivity
- **Bounded concurrency** via semaphore (default 20 active contexts)

## DB tables

- `fb_sessions` — per-tenant authorization data (encrypted)
- `fb_audit_log` — actions VIIV did on customer's behalf
- `chat_conversations` / `chat_messages` — reused from modulechat
  (platform = `'facebook'`)
