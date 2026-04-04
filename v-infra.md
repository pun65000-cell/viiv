VIIV SYSTEM INFRASTRUCTURE (LOCKED SPEC)

1. CORE ARCHITECTURE

VIIV is a modular, API-first, event-driven platform.

All modules MUST communicate via:

- HTTP API (/api/*)
- Event Bus (emit)

Direct coupling between modules is FORBIDDEN.

---

2. SERVERS

APP SERVER

- Framework: FastAPI
- Port: 8000
- Entry: app/main.py
- All endpoints under: /api/*

---

DATABASE SERVER

- Provider: Supabase (PostgreSQL)
- Access via: API / service layer only

STRICT RULE:

- No direct DB access from frontend
- No direct DB access from external modules

---

3. NETWORK FLOW

Client
→ Cloudflare (SSL + protection)
→ Caddy (reverse proxy)
→ FastAPI (app server)
→ Supabase (DB)

---

4. SSL

- Cloudflare handles public HTTPS
- Caddy handles internal routing
- SSL MUST NOT be implemented at app level

---

5. API RULES

- All APIs under /api/*
- JSON only
- No HTML responses
- Stateless design

---

6. EVENT SYSTEM

Location:
modules/event_bus/event_bus.py

Usage:
emit(event_name, payload)

---

EVENT ID RULE

- MUST use: evt_*
- Generated via: gen_id("evt")

---

REQUEST ID

- MUST use: req_*
- Generated via: attach_req_id middleware
- Automatically injected into events

---

7. ID SYSTEM

Allowed prefixes:

- usr_ (user)
- cus_ (customer)
- prd_ (product)
- ord_ (order)
- evt_ (event)
- shp_ (shop)
- stf_ (staff)
- crt_ (cart)
- req_ (request)

---

RULES:

- IDs must follow: prefix_timestamp_random
- UUID-only IDs are NOT standard for business entities
- DO NOT introduce new prefixes

---

8. TENANT SYSTEM

- tenant_id = UUID (DB primary key)
- slug = subdomain (e.g. main.viiv.me)

STRICT RULE:

- tenant_id MUST be UUID in DB queries
- slug MUST NOT be used as tenant_id

---

9. DOMAIN STRUCTURE

Tenant
→ Shop
→ Staff
→ Product
→ Order

---

10. MODULE RULES

- Each module must be isolated
- Communication via API or event bus only
- No direct import between modules unless approved

---

11. FORBIDDEN CHANGES

DO NOT:

- Modify event bus implementation
- Change ID generation format
- Replace tenant UUID with slug
- Add new routing outside /api
- Bypass API layer to access DB

---

12. DEVELOPMENT MODE

- Dev auth may inject request.state.user_id / tenant_id
- MUST NOT override ID system (evt_ / req_)

---

13. SINGLE SOURCE OF TRUTH

This file is the authoritative system definition.

All agents MUST read this file before making changes.

---

END OF FILE

---

VALIDATION:

- File must be created at exact path
- No other file modified
- Content must match exactly
