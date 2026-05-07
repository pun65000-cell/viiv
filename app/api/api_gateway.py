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
