"""
Tenant credits API — Part 3A
Auth: tenant JWT (viiv_token); tenant_id resolved จาก JWT เท่านั้น (Rule 67)

5 endpoints:
  GET  /api/tenant/credits                 — current balance + monthly quota
  GET  /api/tenant/credits/history         — credit_ledger entries
  GET  /api/tenant/credits/topup-packages  — active topup tiers
  POST /api/tenant/credits/topup           — multipart, ADMIN_ROLES gate, INSERT pending
  GET  /api/tenant/credits/topup-status    — credit_topups status by tenant
"""
import os, shutil, uuid, time, json
from datetime import datetime, timedelta, timezone
from typing import Optional
from pathlib import Path

import jwt
from fastapi import APIRouter, Header, HTTPException, UploadFile, File, Form, Query
from sqlalchemy import text
from app.core.db import engine

router = APIRouter(tags=["tenant-credits"])
JWT_SECRET = os.getenv("JWT_SECRET", "")

ADMIN_ROLES = {"owner", "md", "shop_admin", "admin"}
PAYMENT_METHODS = {"bank_transfer", "promptpay"}
MAX_SLIP_BYTES = 5 * 1024 * 1024
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp"}
UPLOAD_ROOT = "/home/viivadmin/viiv/uploads/topup"


# ─────────────────────── Auth helpers ───────────────────────

def _decode(authorization: str) -> dict:
    try:
        token = (authorization or "").replace("Bearer ", "").strip()
        if not token:
            raise HTTPException(401, "missing token")
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"],
                          options={"leeway": 864000, "verify_exp": False})
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(401, "invalid token")


def _resolve_tenant(payload: dict) -> str:
    tid = payload.get("tenant_id")
    if tid:
        return tid
    sub = payload.get("sub")
    if sub:
        with engine.connect() as c:
            r = c.execute(text("SELECT tenant_id FROM tenant_staff WHERE id=:id LIMIT 1"),
                          {"id": sub}).fetchone()
            if r and r[0]:
                return r[0]
    raise HTTPException(401, "no tenant for token")


def _get_ctx(authorization: str):
    payload = _decode(authorization)
    tid = _resolve_tenant(payload)
    role = (payload.get("role") or "").lower()
    return tid, role, payload


# ─────────────────────── Helpers ───────────────────────

def _next_reset_date_iso() -> str:
    """First day of next month (UTC, YYYY-MM-DD)"""
    now = datetime.now(timezone.utc)
    if now.month == 12:
        nxt = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        nxt = datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)
    return nxt.strftime("%Y-%m-%d")


def _safe_filename(name: str) -> str:
    base = os.path.basename(name or "")
    keep = []
    for ch in base:
        if ch.isalnum() or ch in ("-", "_", "."):
            keep.append(ch)
        else:
            keep.append("_")
    safe = "".join(keep).strip("._")
    return safe or "slip"


# ─────────────────────── ENDPOINT 1: GET /api/tenant/credits ───────────────────────

@router.get("")
def get_credits(authorization: str = Header(None)):
    tid, _role, _payload = _get_ctx(authorization)
    with engine.connect() as c:
        row = c.execute(text("""
            SELECT atc.credit_subscription, atc.credit_rollover, atc.credit_topup,
                   atc.credit_used, t.package_id, p.name AS package_name, p.credit_monthly
              FROM ai_tenant_credits atc
              LEFT JOIN tenants t ON t.id = atc.tenant_id
              LEFT JOIN packages p ON p.id = t.package_id
             WHERE atc.tenant_id = :tid
             LIMIT 1
        """), {"tid": tid}).fetchone()

        if not row:
            # No row in ai_tenant_credits — try resolve package via tenant alone
            pkg = c.execute(text("""
                SELECT t.package_id, p.name AS package_name, p.credit_monthly
                  FROM tenants t
                  LEFT JOIN packages p ON p.id = t.package_id
                 WHERE t.id = :tid
                 LIMIT 1
            """), {"tid": tid}).fetchone()
            sub = roll = topup = used = 0
            package_id = pkg[0] if pkg else None
            package_name = pkg[1] if pkg else None
            credit_monthly = pkg[2] if pkg else None
        else:
            sub = int(row[0] or 0)
            roll = int(row[1] or 0)
            topup = int(row[2] or 0)
            used = int(row[3] or 0)
            package_id = row[4]
            package_name = row[5]
            credit_monthly = row[6]

    monthly_quota = int(credit_monthly) if credit_monthly is not None else 0
    total = sub + roll + topup
    warning_pct = 20
    is_low = (monthly_quota > 0) and (total < (monthly_quota * warning_pct / 100.0))

    return {
        "tenant_id": tid,
        "package_id": package_id,
        "package_name": package_name,
        "subscription": {
            "current": sub,
            "monthly_quota": monthly_quota,
            "next_reset_date": _next_reset_date_iso(),
        },
        "rollover": {"current": roll},
        "topup": {"current": topup},
        "total": total,
        "used_this_month": used,
        "warning_pct": warning_pct,
        "is_low": bool(is_low),
    }


# ─────────────────────── ENDPOINT 2: GET /api/tenant/credits/history ───────────────────────

VALID_TXN_TYPES = {"all", "consume", "topup", "subscription", "refund", "adjust", "reset", "migrate"}


@router.get("/history")
def get_history(
    limit: int = Query(30, ge=1, le=100),
    type: str = Query("all"),
    authorization: str = Header(None),
):
    tid, _role, _payload = _get_ctx(authorization)
    if type not in VALID_TXN_TYPES:
        raise HTTPException(400, "Invalid type filter")

    with engine.connect() as c:
        params = {"tid": tid, "type": type, "limit": limit}
        rows = c.execute(text("""
            SELECT id, txn_type, action_key, amount, balance_after, source,
                   reference_id, topup_amount_thb, metadata, created_at, created_by
              FROM credit_ledger
             WHERE tenant_id = :tid
               AND (:type = 'all' OR txn_type = :type)
             ORDER BY created_at DESC
             LIMIT :limit
        """), params).fetchall()

        total_count = c.execute(text("""
            SELECT COUNT(*) FROM credit_ledger
             WHERE tenant_id = :tid
               AND (:type = 'all' OR txn_type = :type)
        """), {"tid": tid, "type": type}).scalar() or 0

    entries = []
    for r in rows:
        meta = r[8]
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except Exception:
                meta = {}
        entries.append({
            "id": r[0],
            "txn_type": r[1],
            "action_key": r[2],
            "amount": int(r[3] or 0),
            "balance_after": int(r[4] or 0),
            "source": r[5],
            "reference_id": r[6],
            "topup_amount_thb": float(r[7]) if r[7] is not None else None,
            "metadata": meta or {},
            "created_at": r[9].isoformat() if r[9] else None,
            "created_by": r[10],
        })
    return {"entries": entries, "total_count": int(total_count)}


# ─────────────────────── ENDPOINT 3: GET /api/tenant/credits/topup-packages ───────────────────────

@router.get("/topup-packages")
def get_topup_packages(authorization: str = Header(None)):
    _tid, _role, _payload = _get_ctx(authorization)
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT id, display_name, amount_thb, credits, bonus_pct, badge,
                   description, sort_order
              FROM topup_packages
             WHERE is_active = true
             ORDER BY sort_order, amount_thb
        """)).fetchall()

    packages = []
    for r in rows:
        amount = float(r[2] or 0)
        credits_val = int(r[3] or 0)
        rate = round(credits_val / amount, 2) if amount > 0 else 0
        packages.append({
            "id": r[0],
            "display_name": r[1],
            "amount_thb": amount,
            "credits": credits_val,
            "bonus_pct": float(r[4]) if r[4] is not None else 0,
            "rate": rate,
            "badge": r[5],
            "description": r[6],
            "sort_order": int(r[7] or 0),
        })
    return {"packages": packages}


# ─────────────────────── ENDPOINT 4: POST /api/tenant/credits/topup ───────────────────────

@router.post("/topup")
async def request_topup(
    topup_package_id: str = Form(...),
    payment_method: str = Form(...),
    slip: UploadFile = File(...),
    authorization: str = Header(None),
):
    tid, role, payload = _get_ctx(authorization)
    if role not in ADMIN_ROLES:
        raise HTTPException(403, "Permission denied — admin role required")

    if payment_method not in PAYMENT_METHODS:
        raise HTTPException(400, "Invalid payment method")

    if not slip or not slip.filename:
        raise HTTPException(400, "Slip image required")

    ctype = (slip.content_type or "").lower()
    if not ctype.startswith("image/"):
        raise HTTPException(415, "Slip must be image (jpg/png/webp)")

    ext = os.path.splitext(slip.filename)[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(415, "Slip must be image (jpg/png/webp)")

    # Read and validate size
    contents = await slip.read()
    if len(contents) > MAX_SLIP_BYTES:
        raise HTTPException(413, "Slip file too large (max 5MB)")
    if len(contents) == 0:
        raise HTTPException(400, "Slip image required")

    with engine.begin() as c:
        pkg = c.execute(text("""
            SELECT id, amount_thb, credits, bonus_pct
              FROM topup_packages
             WHERE id = :tpid AND is_active = true
             LIMIT 1
        """), {"tpid": topup_package_id}).fetchone()
        if not pkg:
            raise HTTPException(400, "Invalid topup package")

        amount_thb = float(pkg[1] or 0)
        credits_added = int(pkg[2] or 0)
        bonus_pct = float(pkg[3]) if pkg[3] is not None else 0.0
        conversion_rate = round(credits_added / amount_thb, 4) if amount_thb > 0 else 0

        # Save slip
        tenant_dir = os.path.join(UPLOAD_ROOT, tid)
        os.makedirs(tenant_dir, exist_ok=True)
        ts = int(time.time())
        fname = f"{ts}_{_safe_filename(slip.filename)}"
        dest = os.path.join(tenant_dir, fname)
        with open(dest, "wb") as f:
            f.write(contents)
        slip_url = f"/uploads/topup/{tid}/{fname}"

        # INSERT credit_topups (id auto-gen via DB default)
        row = c.execute(text("""
            INSERT INTO credit_topups (
                tenant_id, amount_thb, credits_added, conversion_rate,
                topup_package_id, payment_method, slip_url, status
            ) VALUES (
                :tid, :amt, :cr, :rate, :tpid, :pm, :slip, 'pending'
            )
            RETURNING id, status
        """), {
            "tid": tid,
            "amt": amount_thb,
            "cr": credits_added,
            "rate": conversion_rate,
            "tpid": topup_package_id,
            "pm": payment_method,
            "slip": slip_url,
        }).fetchone()

    return {
        "topup_id": row[0],
        "status": row[1],
        "amount_thb": amount_thb,
        "credits": credits_added,
        "bonus_pct": bonus_pct,
        "estimated_approve_time": "ภายใน 1 ชั่วโมง",
        "message": "คำขอเติมเครดิตอยู่ระหว่างตรวจสอบ",
    }


# ─────────────────────── ENDPOINT 5: GET /api/tenant/credits/topup-status ───────────────────────

VALID_TOPUP_STATUS = {"all", "pending", "approved", "rejected", "cancelled"}


@router.get("/topup-status")
def get_topup_status(
    limit: int = Query(10, ge=1, le=50),
    status: str = Query("all"),
    authorization: str = Header(None),
):
    tid, _role, _payload = _get_ctx(authorization)
    if status not in VALID_TOPUP_STATUS:
        raise HTTPException(400, "Invalid status filter")

    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT id, topup_package_id, amount_thb, credits_added, conversion_rate,
                   payment_method, slip_url, status, approved_at, approved_by,
                   rejected_reason, created_at
              FROM credit_topups
             WHERE tenant_id = :tid
               AND (:status = 'all' OR status = :status)
             ORDER BY created_at DESC
             LIMIT :limit
        """), {"tid": tid, "status": status, "limit": limit}).fetchall()

    topups = []
    for r in rows:
        topups.append({
            "id": r[0],
            "topup_package_id": r[1],
            "amount_thb": float(r[2]) if r[2] is not None else 0,
            "credits_added": int(r[3] or 0),
            "conversion_rate": float(r[4]) if r[4] is not None else None,
            "payment_method": r[5],
            "slip_url": r[6],
            "status": r[7],
            "approved_at": r[8].isoformat() if r[8] else None,
            "approved_by": r[9],
            "rejected_reason": r[10],
            "created_at": r[11].isoformat() if r[11] else None,
        })
    return {"topups": topups}


# ─────────────────────── ENDPOINT 6: GET /api/tenant/credits/payment-info ───────────────────────
# Public bank account list สำหรับ Top-up modal (tenant role ใดก็เห็นได้)
# Filter: is_active=true AND feature_visible=true
# Sort: is_default DESC, sort_order ASC, created_at DESC
# Hide internal: short_name, sort_order, timestamps

@router.get("/payment-info")
def get_payment_info(authorization: str = Header(None)):
    _get_ctx(authorization)  # tenant JWT (any role) — แค่ verify ผ่าน
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT id, bank_code, bank_name, account_no, account_name,
                   branch, qr_url, is_default
              FROM platform_bank_accounts
             WHERE is_active = true
               AND feature_visible = true
             ORDER BY is_default DESC, sort_order ASC, created_at DESC
        """)).mappings().all()

    accounts = []
    for r in rows:
        accounts.append({
            "id":           r["id"],
            "bank_code":    r["bank_code"],
            "bank_name":    r["bank_name"],
            "account_no":   r["account_no"],
            "account_name": r["account_name"],
            "branch":       r["branch"],
            "qr_url":       r["qr_url"],
            "is_default":   bool(r["is_default"]),
        })
    return {"accounts": accounts}
