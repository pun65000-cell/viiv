# VIIV Cookie Module (Phase F)

Browser sandbox สำหรับลูกค้า login Facebook → extract cookies → ส่งกลับ VIIV

## Architecture
- Docker network: viiv-cookie-sandbox (172.30.0.0/16, isolated)
- Browser image: jlesage/firefox:latest
- Proxy: NodeMaven Thailand (rotate IP per session)
- Access: dev7.viiv.me/browser/{session_id}/* → localhost:5800

## Lifecycle
1. Customer click "เชื่อม Facebook" ใน VIIV PWA
2. VIIV core spawn container with unique session_id
3. Customer login FB ผ่าน noVNC viewer (mobile/PC)
4. JS extension extract cookies → encrypt → POST VIIV
5. Container destroyed (--rm)

## Files
- policies/policies.json.template: Firefox enterprise policy (proxy + privacy)
- compose/firefox-template.env: env vars per container
- scripts/spawn.sh: manual spawn helper (development only)
- scripts/verify.sh: verify IP from proxy (development only)

## Built in Phase
- F.A (this): infrastructure foundation
- F.B: FastAPI orchestrator
- F.C: cookie extraction + E2E encryption
- F.D: VIIV app integration
- F.E: POC test (IHeal Thy account)
- F.F: Re-login UX
- F.G: Multi-tenant verification
