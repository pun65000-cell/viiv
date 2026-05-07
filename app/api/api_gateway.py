# api_gateway.py — Platform API Gateway control plane (Phase 2)
# Pattern: sync SQLAlchemy + JWT header auth (mirrors platform_ai.py)

import os, jwt
from typing import Optional
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from app.core.db import engine

router = APIRouter(prefix="/gateway", tags=["platform-gateway"])

JWT_SECRET = os.getenv("JWT_SECRET", "21cc8b2ff8e25e6262effb2b47b15c39fb16438525b6d041bb842a130c08be7c")

ALLOWED_CATEGORIES = ("chat", "autopost", "ai", "pos", "other")
ALLOWED_COST_BASIS = ("per_request", "per_token", "per_image", "per_minute")


def _admin_auth(authorization: Optional[str]):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "No token")
    try:
        tok = authorization.replace("Bearer ", "").strip()
        payload = jwt.decode(tok, JWT_SECRET, algorithms=["HS256"],
                             options={"leeway": 864000, "verify_exp": False})
        if payload.get("is_admin") or payload.get("role") in ("admin", "superadmin"):
            return payload
        if (payload.get("tenant_id") or payload.get("sub")
                or payload.get("user_id") or payload.get("email")):
            return payload
    except Exception:
        pass
    raise HTTPException(401, "Unauthorized")


def _row_to_dict(row):
    return dict(row._mapping) if row is not None else None


# ─── GET /api/platform/gateway/pricing ───────────────────────────────
@router.get("/pricing")
def list_pricing(authorization: str = Header(None)):
    _admin_auth(authorization)
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT action_key, display_name, description, category,
                   cost, cost_basis, estimated_cost_usd, margin_pct,
                   is_active, updated_at, updated_by
            FROM credit_pricing
            ORDER BY category, cost ASC, action_key ASC
        """)).mappings().all()
    return {"pricing": [dict(r) for r in rows]}


# ─── PUT /api/platform/gateway/pricing/{action_key} ──────────────────
class PricingUpdate(BaseModel):
    cost: Optional[int] = None
    is_active: Optional[bool] = None
    display_name: Optional[str] = None
    description: Optional[str] = None
    estimated_cost_usd: Optional[float] = None
    margin_pct: Optional[float] = None


@router.put("/pricing/{action_key}")
def update_pricing(action_key: str, body: PricingUpdate, authorization: str = Header(None)):
    payload = _admin_auth(authorization)
    sets = []
    params = {"key": action_key}

    if body.cost is not None:
        if body.cost < 0:
            raise HTTPException(400, "cost ต้อง >= 0")
        sets.append("cost = :cost")
        params["cost"] = body.cost
    if body.is_active is not None:
        sets.append("is_active = :is_active")
        params["is_active"] = body.is_active
    if body.display_name is not None:
        sets.append("display_name = :display_name")
        params["display_name"] = body.display_name.strip()
    if body.description is not None:
        sets.append("description = :description")
        params["description"] = body.description.strip()
    if body.estimated_cost_usd is not None:
        sets.append("estimated_cost_usd = :estimated_cost_usd")
        params["estimated_cost_usd"] = body.estimated_cost_usd
    if body.margin_pct is not None:
        sets.append("margin_pct = :margin_pct")
        params["margin_pct"] = body.margin_pct

    if not sets:
        raise HTTPException(400, "ไม่มี field ให้ update")

    sets.append("updated_at = NOW()")
    sets.append("updated_by = :updated_by")
    params["updated_by"] = payload.get("email") or payload.get("sub") or "platform_admin"

    with engine.begin() as c:
        r = c.execute(text(
            "UPDATE credit_pricing SET " + ", ".join(sets) + " WHERE action_key = :key"
        ), params)
        if r.rowcount == 0:
            raise HTTPException(404, "ไม่พบ action_key นี้")
        row = c.execute(text("""
            SELECT action_key, display_name, description, category,
                   cost, cost_basis, estimated_cost_usd, margin_pct,
                   is_active, updated_at, updated_by
            FROM credit_pricing WHERE action_key = :key
        """), {"key": action_key}).mappings().first()

    return {"ok": True, "pricing": dict(row) if row else None}


# ─── POST /api/platform/gateway/pricing ──────────────────────────────
class PricingCreate(BaseModel):
    action_key: str
    display_name: str
    category: str
    cost: int
    cost_basis: Optional[str] = "per_request"
    description: Optional[str] = None
    estimated_cost_usd: Optional[float] = None
    margin_pct: Optional[float] = None


@router.post("/pricing")
def create_pricing(body: PricingCreate, authorization: str = Header(None)):
    payload = _admin_auth(authorization)

    key = (body.action_key or "").strip()
    if not key:
        raise HTTPException(400, "action_key ต้องไม่ว่าง")
    if body.cost < 0:
        raise HTTPException(400, "cost ต้อง >= 0")
    if body.category not in ALLOWED_CATEGORIES:
        raise HTTPException(400, f"category ต้องอยู่ใน {ALLOWED_CATEGORIES}")
    cost_basis = body.cost_basis or "per_request"
    if cost_basis not in ALLOWED_COST_BASIS:
        raise HTTPException(400, f"cost_basis ต้องอยู่ใน {ALLOWED_COST_BASIS}")

    with engine.begin() as c:
        existing = c.execute(text("SELECT 1 FROM credit_pricing WHERE action_key = :key"),
                             {"key": key}).first()
        if existing:
            raise HTTPException(409, "action_key นี้มีอยู่แล้ว")

        c.execute(text("""
            INSERT INTO credit_pricing (
                action_key, display_name, description, category,
                cost, cost_basis, estimated_cost_usd, margin_pct,
                is_active, updated_at, updated_by
            ) VALUES (
                :action_key, :display_name, :description, :category,
                :cost, :cost_basis, :estimated_cost_usd, :margin_pct,
                true, NOW(), :updated_by
            )
        """), {
            "action_key": key,
            "display_name": body.display_name.strip(),
            "description": (body.description or "").strip() or None,
            "category": body.category,
            "cost": body.cost,
            "cost_basis": cost_basis,
            "estimated_cost_usd": body.estimated_cost_usd,
            "margin_pct": body.margin_pct,
            "updated_by": payload.get("email") or payload.get("sub") or "platform_admin",
        })
        row = c.execute(text("""
            SELECT action_key, display_name, description, category,
                   cost, cost_basis, estimated_cost_usd, margin_pct,
                   is_active, updated_at, updated_by
            FROM credit_pricing WHERE action_key = :key
        """), {"key": key}).mappings().first()

    return {"ok": True, "pricing": dict(row) if row else None}


# ─── DELETE /api/platform/gateway/pricing/{action_key} ───────────────
# Soft delete: set is_active=false (ห้าม hard delete เพราะ credit_ledger อาจ FK)
@router.delete("/pricing/{action_key}")
def soft_delete_pricing(action_key: str, authorization: str = Header(None)):
    payload = _admin_auth(authorization)
    with engine.begin() as c:
        r = c.execute(text("""
            UPDATE credit_pricing
            SET is_active = false,
                updated_at = NOW(),
                updated_by = :updated_by
            WHERE action_key = :key
        """), {
            "key": action_key,
            "updated_by": payload.get("email") or payload.get("sub") or "platform_admin",
        })
        if r.rowcount == 0:
            raise HTTPException(404, "ไม่พบ action_key นี้")
    return {"ok": True}


# ════════════════════════════════════════════════════════════════════
#  Top-up Packages — scale tier (จ่ายเยอะ ได้เครดิตเยอะกว่าสัดส่วน)
# ════════════════════════════════════════════════════════════════════

# ─── GET /api/platform/gateway/topup-packages ────────────────────────
@router.get("/topup-packages")
def list_topup_packages(authorization: str = Header(None)):
    _admin_auth(authorization)
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT id, display_name, amount_thb, credits, bonus_pct,
                   badge, description, sort_order, is_active,
                   created_at, updated_at
            FROM topup_packages
            ORDER BY sort_order ASC, created_at ASC
        """)).mappings().all()
    return {"packages": [dict(r) for r in rows]}


# ─── PUT /api/platform/gateway/topup-packages/{id} ───────────────────
class TopupUpdate(BaseModel):
    display_name: Optional[str] = None
    amount_thb: Optional[float] = None
    credits: Optional[int] = None
    bonus_pct: Optional[float] = None
    badge: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


@router.put("/topup-packages/{pkg_id}")
def update_topup_package(pkg_id: str, body: TopupUpdate, authorization: str = Header(None)):
    _admin_auth(authorization)
    sets = []
    params = {"id": pkg_id}

    if body.display_name is not None:
        sets.append("display_name = :display_name")
        params["display_name"] = body.display_name.strip()
    if body.amount_thb is not None:
        if body.amount_thb <= 0:
            raise HTTPException(400, "amount_thb ต้อง > 0")
        sets.append("amount_thb = :amount_thb")
        params["amount_thb"] = body.amount_thb
    if body.credits is not None:
        if body.credits <= 0:
            raise HTTPException(400, "credits ต้อง > 0")
        sets.append("credits = :credits")
        params["credits"] = body.credits
    if body.bonus_pct is not None:
        if body.bonus_pct < 0:
            raise HTTPException(400, "bonus_pct ต้อง >= 0")
        sets.append("bonus_pct = :bonus_pct")
        params["bonus_pct"] = body.bonus_pct
    if body.badge is not None:
        sets.append("badge = :badge")
        params["badge"] = body.badge.strip() or None
    if body.description is not None:
        sets.append("description = :description")
        params["description"] = body.description.strip() or None
    if body.sort_order is not None:
        sets.append("sort_order = :sort_order")
        params["sort_order"] = body.sort_order
    if body.is_active is not None:
        sets.append("is_active = :is_active")
        params["is_active"] = body.is_active

    if not sets:
        raise HTTPException(400, "ไม่มี field ให้ update")

    sets.append("updated_at = NOW()")

    with engine.begin() as c:
        r = c.execute(text(
            "UPDATE topup_packages SET " + ", ".join(sets) + " WHERE id = :id"
        ), params)
        if r.rowcount == 0:
            raise HTTPException(404, "ไม่พบ package id นี้")
        row = c.execute(text("""
            SELECT id, display_name, amount_thb, credits, bonus_pct,
                   badge, description, sort_order, is_active,
                   created_at, updated_at
            FROM topup_packages WHERE id = :id
        """), {"id": pkg_id}).mappings().first()

    return {"ok": True, "package": dict(row) if row else None}


# ─── POST /api/platform/gateway/topup-packages ───────────────────────
class TopupCreate(BaseModel):
    display_name: str
    amount_thb: float
    credits: int
    bonus_pct: Optional[float] = 0
    badge: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = 0


@router.post("/topup-packages")
def create_topup_package(body: TopupCreate, authorization: str = Header(None)):
    _admin_auth(authorization)

    name = (body.display_name or "").strip()
    if not name:
        raise HTTPException(400, "display_name ต้องไม่ว่าง")
    if body.amount_thb <= 0:
        raise HTTPException(400, "amount_thb ต้อง > 0")
    if body.credits <= 0:
        raise HTTPException(400, "credits ต้อง > 0")
    bonus = body.bonus_pct if body.bonus_pct is not None else 0
    if bonus < 0:
        raise HTTPException(400, "bonus_pct ต้อง >= 0")

    with engine.begin() as c:
        new_id = c.execute(text("""
            INSERT INTO topup_packages (
                display_name, amount_thb, credits, bonus_pct,
                badge, description, sort_order, is_active,
                created_at, updated_at
            ) VALUES (
                :display_name, :amount_thb, :credits, :bonus_pct,
                :badge, :description, :sort_order, true,
                NOW(), NOW()
            )
            RETURNING id
        """), {
            "display_name": name,
            "amount_thb": body.amount_thb,
            "credits": body.credits,
            "bonus_pct": bonus,
            "badge": (body.badge or "").strip() or None,
            "description": (body.description or "").strip() or None,
            "sort_order": body.sort_order or 0,
        }).scalar()

        row = c.execute(text("""
            SELECT id, display_name, amount_thb, credits, bonus_pct,
                   badge, description, sort_order, is_active,
                   created_at, updated_at
            FROM topup_packages WHERE id = :id
        """), {"id": new_id}).mappings().first()

    return {"ok": True, "package": dict(row) if row else None}


# ─── DELETE /api/platform/gateway/topup-packages/{id} ────────────────
# Soft delete (credit_topups อาจ FK ในอนาคต — ปลอดภัยกว่า)
@router.delete("/topup-packages/{pkg_id}")
def soft_delete_topup_package(pkg_id: str, authorization: str = Header(None)):
    _admin_auth(authorization)
    with engine.begin() as c:
        r = c.execute(text("""
            UPDATE topup_packages
            SET is_active = false, updated_at = NOW()
            WHERE id = :id
        """), {"id": pkg_id})
        if r.rowcount == 0:
            raise HTTPException(404, "ไม่พบ package id นี้")
    return {"ok": True}


# ─── PATCH /api/platform/gateway/topup-packages/{id}/order ───────────
class TopupOrder(BaseModel):
    sort_order: int


@router.patch("/topup-packages/{pkg_id}/order")
def reorder_topup_package(pkg_id: str, body: TopupOrder, authorization: str = Header(None)):
    _admin_auth(authorization)
    with engine.begin() as c:
        r = c.execute(text("""
            UPDATE topup_packages
            SET sort_order = :sort_order, updated_at = NOW()
            WHERE id = :id
        """), {"id": pkg_id, "sort_order": body.sort_order})
        if r.rowcount == 0:
            raise HTTPException(404, "ไม่พบ package id นี้")
    return {"ok": True}


# ════════════════════════════════════════════════════════════════════
#  Top-up Approvals — admin approve/reject lookup credit_topups
# ════════════════════════════════════════════════════════════════════

# ─── GET /api/platform/gateway/topup-approvals ───────────────────────
@router.get("/topup-approvals")
def list_topup_approvals(status: str = "pending", authorization: str = Header(None)):
    _admin_auth(authorization)
    if status not in ("pending", "approved", "rejected", "cancelled", "all"):
        raise HTTPException(400, "status ไม่ถูกต้อง")
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT ct.id, ct.tenant_id, ct.amount_thb, ct.credits_added,
                   ct.conversion_rate, ct.topup_package_id, ct.payment_method,
                   ct.slip_url, ct.status, ct.approved_by, ct.approved_at,
                   ct.rejected_reason, ct.ledger_id, ct.created_at,
                   t.store_name, t.subdomain
            FROM credit_topups ct
            JOIN tenants t ON ct.tenant_id = t.id
            WHERE (:status = 'all' OR ct.status = :status)
            ORDER BY ct.created_at DESC
            LIMIT 100
        """), {"status": status}).mappings().all()
    return {"topups": [dict(r) for r in rows]}


# ─── POST /api/platform/gateway/topup-approvals/{id}/approve ─────────
@router.post("/topup-approvals/{topup_id}/approve")
def approve_topup(topup_id: str, authorization: str = Header(None)):
    payload = _admin_auth(authorization)
    admin_id = payload.get("email") or payload.get("sub") or "platform_admin"

    with engine.begin() as c:
        # 1. lock + verify topup status = 'pending'
        topup = c.execute(text("""
            SELECT id, tenant_id, amount_thb, credits_added, status
            FROM credit_topups WHERE id = :id FOR UPDATE
        """), {"id": topup_id}).mappings().first()
        if not topup:
            raise HTTPException(404, "ไม่พบ top-up นี้")
        if topup["status"] != "pending":
            raise HTTPException(400, f"top-up นี้สถานะ {topup['status']} แล้ว ไม่ใช่ pending")

        tid = topup["tenant_id"]
        credits_added = int(topup["credits_added"])

        # 2. ensure ai_tenant_credits row + read current balance
        c.execute(text("""
            INSERT INTO ai_tenant_credits (tenant_id, credit_topup, updated_at)
            VALUES (:tid, 0, NOW())
            ON CONFLICT (tenant_id) DO NOTHING
        """), {"tid": tid})
        old_topup = c.execute(text("""
            SELECT credit_topup FROM ai_tenant_credits WHERE tenant_id = :tid
        """), {"tid": tid}).scalar() or 0
        new_topup = int(old_topup) + credits_added

        # 3. INSERT credit_ledger
        ledger_id = c.execute(text("""
            INSERT INTO credit_ledger (
                tenant_id, txn_type, amount, balance_after,
                source, reference_id, topup_amount_thb,
                metadata, created_at, created_by
            ) VALUES (
                :tid, 'topup', :amount, :balance_after,
                'topup', :reference_id, :amount_thb,
                '{}'::jsonb, NOW(), :created_by
            )
            RETURNING id
        """), {
            "tid": tid,
            "amount": credits_added,
            "balance_after": new_topup,
            "reference_id": topup_id,
            "amount_thb": topup["amount_thb"],
            "created_by": admin_id,
        }).scalar()

        # 4. UPDATE ai_tenant_credits.credit_topup
        c.execute(text("""
            UPDATE ai_tenant_credits
            SET credit_topup = :new_topup, updated_at = NOW()
            WHERE tenant_id = :tid
        """), {"tid": tid, "new_topup": new_topup})

        # 5. UPDATE credit_topups status + ledger_id
        c.execute(text("""
            UPDATE credit_topups
            SET status = 'approved',
                approved_by = :approved_by,
                approved_at = NOW(),
                ledger_id = :ledger_id
            WHERE id = :id
        """), {"id": topup_id, "approved_by": admin_id, "ledger_id": ledger_id})

    return {"ok": True, "new_balance": new_topup}


# ─── POST /api/platform/gateway/topup-approvals/{id}/reject ──────────
class RejectBody(BaseModel):
    reason: str


@router.post("/topup-approvals/{topup_id}/reject")
def reject_topup(topup_id: str, body: RejectBody, authorization: str = Header(None)):
    payload = _admin_auth(authorization)
    admin_id = payload.get("email") or payload.get("sub") or "platform_admin"

    reason = (body.reason or "").strip()
    if not reason:
        raise HTTPException(400, "reason ห้ามว่าง")

    with engine.begin() as c:
        topup = c.execute(text("""
            SELECT status FROM credit_topups WHERE id = :id FOR UPDATE
        """), {"id": topup_id}).mappings().first()
        if not topup:
            raise HTTPException(404, "ไม่พบ top-up นี้")
        if topup["status"] != "pending":
            raise HTTPException(400, f"top-up นี้สถานะ {topup['status']} แล้ว ไม่ใช่ pending")

        c.execute(text("""
            UPDATE credit_topups
            SET status = 'rejected',
                approved_by = :approved_by,
                rejected_reason = :reason,
                approved_at = NOW()
            WHERE id = :id
        """), {"id": topup_id, "approved_by": admin_id, "reason": reason})

    return {"ok": True}


# ─── GET /api/platform/gateway/topup-approvals/{id}/slip ─────────────
@router.get("/topup-approvals/{topup_id}/slip")
def get_topup_slip(topup_id: str, authorization: str = Header(None)):
    _admin_auth(authorization)
    with engine.connect() as c:
        row = c.execute(text("""
            SELECT slip_url FROM credit_topups WHERE id = :id
        """), {"id": topup_id}).mappings().first()
        if not row:
            raise HTTPException(404, "ไม่พบ top-up นี้")
    return {"slip_url": row["slip_url"]}
