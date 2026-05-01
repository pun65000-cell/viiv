# app/api/billing.py — Subscription billing (Phase 2)
# Admin-facing endpoints under /api/platform/billing/*

import datetime
from fastapi import APIRouter, Header, HTTPException
from sqlalchemy import text
from app.core.db import engine
from app.api.platform_connections import _admin_auth

router = APIRouter()


def _platform_line_token() -> str:
    with engine.connect() as c:
        row = c.execute(text(
            "SELECT channel_token FROM platform_connections "
            "WHERE platform='line' LIMIT 1"
        )).fetchone()
    return (row[0] if row else "") or ""


def notify_tenant_line(line_uid: str, message: str, access_token: str) -> bool:
    """Push a text message to a tenant via the platform LINE OA.
    Returns True on HTTP 2xx, False otherwise (network errors swallowed)."""
    if not line_uid or not access_token:
        return False
    try:
        import requests
        r = requests.post(
            "https://api.line.me/v2/bot/message/push",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json={"to": line_uid, "messages": [{"type": "text", "text": message}]},
            timeout=5,
        )
        return r.ok
    except Exception:
        return False


def _days_remaining(deadline) -> int | None:
    if not deadline:
        return None
    now = datetime.datetime.now(datetime.timezone.utc)
    return int((deadline - now).total_seconds() // 86400)


# Static notification templates (Phase 3 schedule)
NOTIFY_TEMPLATES: dict[str, str] = {
    "trial_warning": (
        "🔔 ทดลองใช้งาน ViiV เหลืออีก 2 วันครับ\n"
        "หากต้องการใช้งานต่อ ติดต่อทีมงานได้เลยครับ 😊\n"
        "LINE: @004krtts"
    ),
    "trial_expiry": (
        "⏰ วันสุดท้ายของการทดลองใช้งานครับ\n"
        "ยังสามารถเข้าใช้งานได้ปกติวันนี้\n"
        "ติดต่อต่ออายุได้เลยครับ 🙏\n"
        "LINE: @004krtts"
    ),
    "expiry_warning_3d": (
        "🔔 แพ็กเกจของคุณจะหมดอายุในอีก 3 วันครับ\n"
        "ต่ออายุได้เลยเพื่อใช้งานต่อเนื่องครับ 😊\n"
        "LINE: @004krtts"
    ),
    "expiry_warning_1d": (
        "⏰ แพ็กเกจจะหมดพรุ่งนี้ครับ\n"
        "ติดต่อต่ออายุได้เลยนะครับ 🙏\n"
        "LINE: @004krtts"
    ),
    "overdue": (
        "💙 ทีมงาน ViiV ห่วงใยครับ\n"
        "หากมีข้อสงสัยหรือต้องการความช่วยเหลือ\n"
        "ติดต่อได้เลยนะครับ 😊\n"
        "LINE: @004krtts"
    ),
}


def _select_notify_type(billing_status: str, days_remaining: int | None) -> str | None:
    """Pick the template that fits today's schedule.
    Returns None if no template matches (admin can pass ?type= to override)."""
    if days_remaining is None:
        return None
    if billing_status == "trial":
        if days_remaining <= 0:
            return "trial_expiry"
        if days_remaining <= 2:
            return "trial_warning"
        return None
    if billing_status == "active":
        if days_remaining < 0:
            return "overdue"
        if days_remaining <= 1:
            return "expiry_warning_1d"
        if days_remaining <= 3:
            return "expiry_warning_3d"
        return None
    return None


# ── 1) GET /subscriptions ─────────────────────────────────────────────────────
@router.get("/subscriptions")
def list_subscriptions(authorization: str = Header(None)):
    _admin_auth(authorization)
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT t.id, t.email, t.store_name, t.subdomain, t.status,
                   t.billing_status, t.package_id, t.modules,
                   t.trial_ends_at, t.subscription_ends_at, t.line_uid,
                   bp.price AS amount_due
            FROM tenants t
            LEFT JOIN billing_prices bp
              ON bp.package_id = t.package_id
             AND bp.modules    = t.modules
            ORDER BY t.created_at DESC
        """)).mappings().all()

    out = []
    for r in rows:
        bs = r["billing_status"] or "trial"
        deadline = r["trial_ends_at"] if bs == "trial" else r["subscription_ends_at"]
        out.append({
            "tenant_id":            r["id"],
            "email":                r["email"],
            "store_name":           r["store_name"],
            "subdomain":            r["subdomain"],
            "status":               r["status"],
            "billing_status":       bs,
            "package_id":           r["package_id"],
            "modules":              list(r["modules"] or []),
            "trial_ends_at":        r["trial_ends_at"].isoformat() if r["trial_ends_at"] else None,
            "subscription_ends_at": r["subscription_ends_at"].isoformat() if r["subscription_ends_at"] else None,
            "days_remaining":       _days_remaining(deadline),
            "amount_due":           float(r["amount_due"]) if r["amount_due"] is not None else None,
            "has_line":             bool(r["line_uid"]),
        })
    return {"subscriptions": out, "total": len(out)}


# ── 2) POST /confirm-payment ──────────────────────────────────────────────────
@router.post("/confirm-payment")
def confirm_payment(payload: dict, authorization: str = Header(None)):
    auth = _admin_auth(authorization)

    tid       = (payload.get("tenant_id") or "").strip()
    amount    = payload.get("amount")
    pkg       = (payload.get("package_id") or "").strip()
    modules   = payload.get("modules") or []
    due_date  = payload.get("due_date")  # optional ISO date string

    if not tid or amount is None or not pkg or not isinstance(modules, list):
        raise HTTPException(400, "tenant_id, amount, package_id, modules[] required")

    noted_by = (auth.get("email") or auth.get("user_id")
                or auth.get("sub") or "admin")

    with engine.begin() as c:
        exists = c.execute(text("SELECT 1 FROM tenants WHERE id=:tid"),
                           {"tid": tid}).first()
        if not exists:
            raise HTTPException(404, "tenant not found")

        c.execute(text("""
            INSERT INTO billing_invoices
                (tenant_id, amount, package_id, modules, status,
                 due_date, paid_at, noted_by)
            VALUES
                (:tid, :amt, :pkg, :mods, 'paid',
                 :due, NOW(), :by)
        """), {
            "tid": tid, "amt": amount, "pkg": pkg,
            "mods": modules, "due": due_date, "by": noted_by,
        })

        c.execute(text("""
            UPDATE tenants
            SET subscription_ends_at = NOW() + interval '30 days',
                billing_status        = 'active',
                modules               = :mods,
                package_id            = :pkg,
                updated_at            = NOW()
            WHERE id = :tid
        """), {"mods": modules, "pkg": pkg, "tid": tid})

        line_uid = c.execute(text("SELECT line_uid FROM tenants WHERE id=:tid"),
                             {"tid": tid}).scalar()

    sent = False
    if line_uid:
        token = _platform_line_token()
        sent = notify_tenant_line(
            line_uid,
            "✅ ได้รับการชำระเงินแล้วครับ ขอบคุณมากครับ 🙏",
            token,
        )
    return {"ok": True, "tenant_id": tid, "line_notified": sent}


# ── 3) GET /prices ────────────────────────────────────────────────────────────
@router.get("/prices")
def get_prices(authorization: str = Header(None)):
    _admin_auth(authorization)
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT package_id, modules, price
            FROM billing_prices
            ORDER BY package_id, array_length(modules, 1)
        """)).mappings().all()
    return {"prices": [{
        "package_id": r["package_id"],
        "modules":    list(r["modules"] or []),
        "price":      float(r["price"]),
    } for r in rows]}


# ── 4) POST /notify/{tenant_id} ───────────────────────────────────────────────
@router.post("/notify/{tenant_id}")
def notify_tenant(
    tenant_id: str,
    type: str | None = None,        # admin override (optional)
    dry_run: bool = False,          # preview without sending
    authorization: str = Header(None),
):
    _admin_auth(authorization)
    with engine.connect() as c:
        row = c.execute(text("""
            SELECT t.id, t.line_uid, t.billing_status,
                   t.trial_ends_at, t.subscription_ends_at
            FROM tenants t
            WHERE t.id = :tid
        """), {"tid": tenant_id}).mappings().first()

    if not row:
        raise HTTPException(404, "tenant not found")

    bs = row["billing_status"] or "trial"
    deadline = row["trial_ends_at"] if bs == "trial" else row["subscription_ends_at"]
    days_left = _days_remaining(deadline)

    ntype = type or _select_notify_type(bs, days_left)
    if not ntype:
        return {
            "ok": False,
            "tenant_id": tenant_id,
            "reason": "no template matches today's schedule (pass ?type= to override)",
            "billing_status": bs,
            "days_remaining": days_left,
        }
    if ntype not in NOTIFY_TEMPLATES:
        raise HTTPException(400, f"unknown type: {ntype}")
    msg = NOTIFY_TEMPLATES[ntype]

    if dry_run:
        return {"ok": True, "tenant_id": tenant_id, "type": ntype,
                "preview": msg, "dry_run": True}

    if not row["line_uid"]:
        raise HTTPException(400, "tenant has no LINE UID linked")

    token = _platform_line_token()
    sent = notify_tenant_line(row["line_uid"], msg, token)

    with engine.begin() as c:
        c.execute(text("""
            INSERT INTO billing_notifications (tenant_id, type, channel)
            VALUES (:tid, :type, 'line')
        """), {"tid": tenant_id, "type": ntype})

    return {"ok": True, "tenant_id": tenant_id, "type": ntype,
            "days_remaining": days_left, "line_sent": sent}
