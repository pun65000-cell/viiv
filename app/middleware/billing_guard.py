# app/middleware/billing_guard.py — Phase 5
# Soft-block requests for tenants whose subscription has been suspended.
#
# Modes (env BILLING_GUARD_MODE):
#   report   — log to stdout + add header X-Billing-Suspended: 1 (default — safe rollout)
#   enforce  — return 402 JSON for /api/pos/* on suspended tenants
#   off      — bypass middleware entirely
#
# Whitelist (always allowed even when suspended):
#   - non-/api/* paths (HTML, uploads, static)
#   - /api/staff/login, /api/staff/heartbeat, /api/staff/presence
#   - /api/platform/*  (admin ops + billing)
#   - /api/line/*      (webhooks)
#   - /api/health, /api/platform/health
#   - OPTIONS preflight

import os
from time import time as _now
from sqlalchemy import text
from app.core.db import engine

_TTL = 60.0
_billing_cache: dict[str, tuple[str, float]] = {}


def _get_billing_status(tenant_id: str) -> str:
    if not tenant_id or tenant_id == "default":
        return ""
    entry = _billing_cache.get(tenant_id)
    now = _now()
    if entry and now < entry[1]:
        return entry[0]
    try:
        with engine.connect() as c:
            row = c.execute(text(
                "SELECT billing_status FROM tenants WHERE id=:t LIMIT 1"
            ), {"t": tenant_id}).fetchone()
        status = (row[0] or "") if row else ""
    except Exception:
        # cache failure briefly to avoid hot-looping on a bad DB
        _billing_cache[tenant_id] = ("", now + 5.0)
        return ""
    _billing_cache[tenant_id] = (status, now + _TTL)
    return status


def clear_billing_cache(tenant_id: str | None = None) -> None:
    """Called after /confirm-payment so the next request reflects active state."""
    if tenant_id is None:
        _billing_cache.clear()
        return
    _billing_cache.pop(tenant_id, None)


def _path_is_exempt(path: str) -> bool:
    if not path.startswith("/api/"):
        return True
    if path.startswith("/api/platform/") or path.startswith("/api/line/"):
        return True
    if path in (
        "/api/staff/login",
        "/api/staff/heartbeat",
        "/api/staff/presence",
        "/api/health",
        "/api/platform/health",
    ):
        return True
    return False


def _mode() -> str:
    return (os.getenv("BILLING_GUARD_MODE") or "report").strip().lower()


async def billing_guard_middleware(request, call_next):
    mode = _mode()
    if mode == "off":
        return await call_next(request)

    if request.method == "OPTIONS":
        return await call_next(request)

    path = request.url.path
    if _path_is_exempt(path):
        return await call_next(request)

    tid = getattr(request.state, "tenant_id", None) or ""
    status = _get_billing_status(tid)

    if status != "suspended":
        return await call_next(request)

    # suspended — choose mode
    if mode == "report":
        try:
            print({"billing_guard": "report", "tenant_id": tid, "path": path})
        except Exception:
            pass
        response = await call_next(request)
        try:
            response.headers["X-Billing-Suspended"] = "1"
        except Exception:
            pass
        return response

    # enforce
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=402,
        content={
            "detail":  "subscription_expired",
            "message": "กรุณาต่ออายุแพ็กเกจ",
            "contact": "https://line.me/R/ti/p/@004krtts",
        },
        headers={"X-Billing-Suspended": "1"},
    )
