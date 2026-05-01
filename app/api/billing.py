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


def _line_push_text(channel_token: str, to_uid: str, msg: str) -> bool:
    if not channel_token or not to_uid:
        return False
    try:
        import requests
        r = requests.post(
            "https://api.line.me/v2/bot/message/push",
            headers={
                "Authorization": f"Bearer {channel_token}",
                "Content-Type": "application/json",
            },
            json={"to": to_uid, "messages": [{"type": "text", "text": msg}]},
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
        sent = _line_push_text(
            token, line_uid,
            "✅ ได้รับการชำระเงินแล้วครับ ขอบคุณมากครับ 🙏",
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
def notify_tenant(tenant_id: str, authorization: str = Header(None)):
    _admin_auth(authorization)
    with engine.connect() as c:
        row = c.execute(text("""
            SELECT t.id, t.store_name, t.line_uid, t.billing_status,
                   t.trial_ends_at, t.subscription_ends_at,
                   t.package_id, t.modules,
                   bp.price AS amount_due
            FROM tenants t
            LEFT JOIN billing_prices bp
              ON bp.package_id = t.package_id
             AND bp.modules    = t.modules
            WHERE t.id = :tid
        """), {"tid": tenant_id}).mappings().first()

    if not row:
        raise HTTPException(404, "tenant not found")
    if not row["line_uid"]:
        raise HTTPException(400, "tenant has no LINE UID linked")

    bs = row["billing_status"] or "trial"
    deadline = row["trial_ends_at"] if bs == "trial" else row["subscription_ends_at"]
    days_left = _days_remaining(deadline)
    amt = f"{float(row['amount_due']):,.0f}" if row["amount_due"] is not None else "-"
    name = row["store_name"] or "ลูกค้า"
    deadline_str = deadline.strftime("%d/%m/%Y") if deadline else "-"

    if bs == "trial":
        ntype = "trial_warning"
        msg = (
            f"🌟 สวัสดีครับ {name}\n"
            f"ทดลองใช้ ViiV จะหมดอายุวันที่ {deadline_str}\n"
            f"ค่าบริการ {amt} บาท/เดือน\n"
            f"แจ้งชำระได้ที่ @004krtts"
        )
    elif days_left is not None and days_left < 0:
        ntype = "overdue"
        msg = (
            f"⚠️ ค่าบริการ ViiV ค้างชำระแล้ว {abs(days_left)} วัน\n"
            f"กรุณาชำระโดยเร็วเพื่อไม่ให้ระบบถูกระงับ\n"
            f"แจ้งชำระได้ที่ @004krtts"
        )
    else:
        ntype = "expiry_warning"
        msg = (
            f"🔔 ค่าบริการ ViiV จะครบกำหนดในอีก {days_left} วัน\n"
            f"ยอด {amt} บาท/เดือน\n"
            f"แจ้งชำระได้ที่ @004krtts"
        )

    token = _platform_line_token()
    sent = _line_push_text(token, row["line_uid"], msg)

    with engine.begin() as c:
        c.execute(text("""
            INSERT INTO billing_notifications (tenant_id, type, channel)
            VALUES (:tid, :type, 'line')
        """), {"tid": tenant_id, "type": ntype})

    return {"ok": True, "tenant_id": tenant_id, "type": ntype, "line_sent": sent}
