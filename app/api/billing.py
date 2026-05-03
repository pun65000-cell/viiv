# app/api/billing.py — Subscription billing (Phase 2)
# Admin-facing endpoints under /api/platform/billing/*

import datetime
import itertools
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


def _calc_amount(package_id: str | None, modules, conn) -> float:
    """Dynamic price = SUM(module_prices.price) × packages.multiplier
       Returns 0.0 for free packages, missing data, or empty modules."""
    if not package_id:
        return 0.0
    pkg = conn.execute(
        text("SELECT multiplier, fixed_price, type FROM packages WHERE id = :pid"),
        {"pid": package_id},
    ).first()
    if not pkg:
        return 0.0
    if (pkg.type or "") == "free":
        return 0.0
    if pkg.fixed_price is not None:
        return round(float(pkg.fixed_price), 2)
    mods = list(modules or [])
    if not mods:
        return 0.0
    rows = conn.execute(
        text("SELECT module, price FROM module_prices WHERE module = ANY(:mods)"),
        {"mods": mods},
    ).all()
    total = sum(float(r[1]) for r in rows)
    return round(total * float(pkg.multiplier or 0), 2)


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
    out = []
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT t.id, t.email, t.store_name, t.subdomain, t.status,
                   t.billing_status, t.package_id, t.modules,
                   t.trial_ends_at, t.subscription_ends_at, t.line_uid
            FROM tenants t
            ORDER BY t.created_at DESC
        """)).mappings().all()

        for r in rows:
            bs = r["billing_status"] or "trial"
            deadline = r["trial_ends_at"] if bs == "trial" else r["subscription_ends_at"]
            mods = list(r["modules"] or [])
            out.append({
                "tenant_id":            r["id"],
                "email":                r["email"],
                "store_name":           r["store_name"],
                "subdomain":            r["subdomain"],
                "status":               r["status"],
                "billing_status":       bs,
                "package_id":           r["package_id"],
                "modules":              mods,
                "trial_ends_at":        r["trial_ends_at"].isoformat() if r["trial_ends_at"] else None,
                "subscription_ends_at": r["subscription_ends_at"].isoformat() if r["subscription_ends_at"] else None,
                "days_remaining":       _days_remaining(deadline),
                "amount_due":           _calc_amount(r["package_id"], mods, c),
                "has_line":             bool(r["line_uid"]),
            })
    return {"subscriptions": out, "total": len(out)}


# ── 2) POST /confirm-payment ──────────────────────────────────────────────────
@router.post("/confirm-payment")
def confirm_payment(payload: dict, authorization: str = Header(None)):
    auth = _admin_auth(authorization)

    tid       = (payload.get("tenant_id") or "").strip()
    pkg       = (payload.get("package_id") or "").strip()
    modules   = payload.get("modules") or []
    due_date  = payload.get("due_date")  # optional ISO date string

    if not tid or not pkg or not isinstance(modules, list):
        raise HTTPException(400, "tenant_id, package_id, modules[] required")

    noted_by = (auth.get("email") or auth.get("user_id")
                or auth.get("sub") or "admin")

    with engine.begin() as c:
        exists = c.execute(text("SELECT 1 FROM tenants WHERE id=:tid"),
                           {"tid": tid}).first()
        if not exists:
            raise HTTPException(404, "tenant not found")

        amount = _calc_amount(pkg, modules, c)

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

    # Invalidate the billing-guard cache so the next request sees 'active' immediately.
    try:
        from app.middleware.billing_guard import clear_billing_cache
        clear_billing_cache(tid)
    except Exception:
        pass

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
        pkgs = c.execute(text(
            "SELECT id, multiplier, type FROM packages ORDER BY sort_order, id"
        )).mappings().all()
        mods = c.execute(text(
            "SELECT module, price, is_required FROM module_prices ORDER BY sort_order, module"
        )).mappings().all()

    required = [m["module"] for m in mods if m["is_required"]]
    optional = [m["module"] for m in mods if not m["is_required"]]
    price_map = {m["module"]: float(m["price"]) for m in mods}

    out = []
    for pkg in pkgs:
        mult = float(pkg["multiplier"] or 0)
        is_free = (pkg["type"] or "") == "free"
        for r in range(len(optional) + 1):
            for combo in itertools.combinations(optional, r):
                modules = required + list(combo)
                total = sum(price_map[m] for m in modules)
                price = 0.0 if is_free else round(total * mult, 2)
                out.append({
                    "package_id": pkg["id"],
                    "modules":    modules,
                    "price":      price,
                })
    return {"prices": out}


# ── 1b) PATCH /subscriptions/{tenant_id} (manual edit) ────────────────────────
_SUB_ALLOWED_FIELDS = {
    "trial_ends_at", "subscription_ends_at",
    "billing_status", "package_id", "modules",
}
_BILLING_STATUS_VALUES = {"trial", "active", "suspended", "cancelled"}


@router.patch("/subscriptions/{tenant_id}")
def update_subscription(tenant_id: str, payload: dict, authorization: str = Header(None)):
    _admin_auth(authorization)

    fields = {k: payload[k] for k in _SUB_ALLOWED_FIELDS if k in payload}
    if not fields:
        raise HTTPException(400, "no editable fields in payload")

    if "billing_status" in fields and fields["billing_status"] not in _BILLING_STATUS_VALUES:
        raise HTTPException(400, f"billing_status must be one of {sorted(_BILLING_STATUS_VALUES)}")
    if "modules" in fields and not isinstance(fields["modules"], list):
        raise HTTPException(400, "modules must be a list")

    set_clauses = [f"{k} = :{k}" for k in fields.keys()]
    set_clauses.append("updated_at = NOW()")
    params = {**fields, "tid": tenant_id}

    with engine.begin() as c:
        if not c.execute(text("SELECT 1 FROM tenants WHERE id=:tid"),
                         {"tid": tenant_id}).first():
            raise HTTPException(404, "tenant not found")
        c.execute(text(f"UPDATE tenants SET {', '.join(set_clauses)} WHERE id=:tid"), params)

    try:
        from app.middleware.billing_guard import clear_billing_cache
        clear_billing_cache(tenant_id)
    except Exception:
        pass

    with engine.connect() as c:
        row = c.execute(text("""
            SELECT t.id, t.email, t.store_name, t.subdomain, t.status,
                   t.billing_status, t.package_id, t.modules,
                   t.trial_ends_at, t.subscription_ends_at, t.line_uid
            FROM tenants t
            WHERE t.id = :tid
        """), {"tid": tenant_id}).mappings().first()

        bs = row["billing_status"] or "trial"
        deadline = row["trial_ends_at"] if bs == "trial" else row["subscription_ends_at"]
        mods = list(row["modules"] or [])
        amount_due = _calc_amount(row["package_id"], mods, c)

    return {"ok": True, "tenant": {
        "tenant_id":            row["id"],
        "email":                row["email"],
        "store_name":           row["store_name"],
        "subdomain":            row["subdomain"],
        "status":               row["status"],
        "billing_status":       bs,
        "package_id":           row["package_id"],
        "modules":              mods,
        "trial_ends_at":        row["trial_ends_at"].isoformat() if row["trial_ends_at"] else None,
        "subscription_ends_at": row["subscription_ends_at"].isoformat() if row["subscription_ends_at"] else None,
        "days_remaining":       _days_remaining(deadline),
        "amount_due":           amount_due,
        "has_line":             bool(row["line_uid"]),
    }}


# ── 3b) GET /invoices (history) ───────────────────────────────────────────────
@router.get("/invoices")
def list_invoices(authorization: str = Header(None), limit: int = 200):
    _admin_auth(authorization)
    n = max(1, min(int(limit or 200), 1000))
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT i.id, i.tenant_id, t.store_name, t.subdomain,
                   i.amount, i.package_id, i.modules, i.status,
                   i.due_date, i.paid_at, i.noted_by, i.created_at
            FROM billing_invoices i
            LEFT JOIN tenants t ON t.id = i.tenant_id
            ORDER BY i.created_at DESC
            LIMIT :n
        """), {"n": n}).mappings().all()
    return {"invoices": [{
        "id":         r["id"],
        "tenant_id":  r["tenant_id"],
        "store_name": r["store_name"],
        "subdomain":  r["subdomain"],
        "amount":     float(r["amount"]) if r["amount"] is not None else None,
        "package_id": r["package_id"],
        "modules":    list(r["modules"] or []),
        "status":     r["status"],
        "due_date":   r["due_date"].isoformat() if r["due_date"] else None,
        "paid_at":    r["paid_at"].isoformat() if r["paid_at"] else None,
        "noted_by":   r["noted_by"],
        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
    } for r in rows]}


# ── 3c) GET /notifications (history) ──────────────────────────────────────────
@router.get("/notifications")
def list_notifications(authorization: str = Header(None), limit: int = 200):
    _admin_auth(authorization)
    n = max(1, min(int(limit or 200), 1000))
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT n.id, n.tenant_id, t.store_name, t.subdomain,
                   n.type, n.channel, n.sent_at
            FROM billing_notifications n
            LEFT JOIN tenants t ON t.id = n.tenant_id
            ORDER BY n.sent_at DESC
            LIMIT :n
        """), {"n": n}).mappings().all()
    return {"notifications": [{
        "id":         r["id"],
        "tenant_id":  r["tenant_id"],
        "store_name": r["store_name"],
        "subdomain":  r["subdomain"],
        "type":       r["type"],
        "channel":    r["channel"],
        "sent_at":    r["sent_at"].isoformat() if r["sent_at"] else None,
    } for r in rows]}


# ── 4b) POST /run-check (admin-trigger scheduler manually) ────────────────────
@router.post("/run-check")
def run_check_now(authorization: str = Header(None)):
    _admin_auth(authorization)
    from app.scheduler.billing_scheduler import check_billing
    return check_billing()


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
