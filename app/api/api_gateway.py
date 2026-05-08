# api_gateway.py — Platform API Gateway control plane (Phase 2)
# Pattern: sync SQLAlchemy + JWT header auth (mirrors platform_ai.py)

import os, jwt, asyncio, time
from typing import Optional
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
import httpx

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


# ════════════════════════════════════════════════════════════════════
#  Health Monitor — ping endpoints + log to api_health_log
# ════════════════════════════════════════════════════════════════════

# ─── GET /api/platform/gateway/health-status ─────────────────────────
@router.get("/health-status")
def health_status(authorization: str = Header(None)):
    _admin_auth(authorization)
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT e.id, e.name, e.path, e.method, e.category, e.port,
                   e.health_check_enabled, e.notes,
                   l.status_code, l.response_ms, l.is_healthy,
                   l.error_msg, l.checked_at
            FROM api_endpoints e
            LEFT JOIN LATERAL (
                SELECT status_code, response_ms, is_healthy, error_msg, checked_at
                FROM api_health_log
                WHERE endpoint_id = e.id
                ORDER BY checked_at DESC
                LIMIT 1
            ) l ON true
            WHERE e.is_active = true
            ORDER BY e.category ASC, e.port ASC, e.name ASC
        """)).mappings().all()

        last_run = c.execute(text("""
            SELECT value FROM api_gateway_settings WHERE key = 'last_health_check'
        """)).scalar()

    endpoints = [dict(r) for r in rows]
    summary = {
        "total": len(endpoints),
        "healthy": sum(1 for e in endpoints if e.get("is_healthy") is True),
        "failed": sum(1 for e in endpoints if e.get("is_healthy") is False),
        "never_checked": sum(1 for e in endpoints if e.get("checked_at") is None),
    }

    last_run_iso = None
    if last_run:
        try:
            import json
            v = json.loads(last_run) if isinstance(last_run, str) else last_run
            last_run_iso = v if isinstance(v, str) else None
        except Exception:
            last_run_iso = None

    return {"endpoints": endpoints, "summary": summary, "last_run": last_run_iso}


# ─── POST /api/platform/gateway/health-check/run ─────────────────────
async def _ping_one(client: httpx.AsyncClient, ep: dict) -> dict:
    method = (ep.get("health_check_method") or "GET").upper()
    timeout = ep.get("health_check_timeout") or 5
    expected = ep.get("expected_status") or 200
    port = ep.get("port") or 8000
    url = ep.get("health_check_url") or f"http://localhost:{port}{ep.get('path','')}"

    t0 = time.perf_counter()
    status_code = None
    error_msg = None
    is_healthy = False

    try:
        r = await client.request(method, url, timeout=timeout)
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        status_code = r.status_code
        is_healthy = (status_code == expected)
        if not is_healthy:
            error_msg = f"status {status_code} != expected {expected}"
    except httpx.TimeoutException:
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        error_msg = "timeout"
    except (httpx.ConnectError, httpx.RequestError) as e:
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        error_msg = f"{type(e).__name__}: {str(e)[:120]}"
    except Exception as e:
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        error_msg = f"{type(e).__name__}: {str(e)[:120]}"

    return {
        "endpoint_id": ep["id"],
        "status_code": status_code,
        "response_ms": elapsed_ms,
        "is_healthy": bool(is_healthy),
        "error_msg": error_msg,
    }


@router.post("/health-check/run")
async def run_health_check(authorization: str = Header(None)):
    _admin_auth(authorization)

    t_start = time.perf_counter()
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT id, path, method, port,
                   health_check_url, health_check_method,
                   health_check_timeout, expected_status
            FROM api_endpoints
            WHERE is_active = true AND health_check_enabled = true
        """)).mappings().all()
    endpoints = [dict(r) for r in rows]

    if not endpoints:
        return {"ok": True, "summary": {"total": 0, "healthy": 0, "failed": 0}, "duration_ms": 0}

    async with httpx.AsyncClient(verify=False, follow_redirects=False) as client:
        results = await asyncio.gather(*(_ping_one(client, ep) for ep in endpoints))

    healthy = sum(1 for r in results if r["is_healthy"])
    failed = len(results) - healthy

    with engine.begin() as c:
        for r in results:
            c.execute(text("""
                INSERT INTO api_health_log (
                    endpoint_id, status_code, response_ms,
                    is_healthy, error_msg, checked_at
                ) VALUES (
                    :endpoint_id, :status_code, :response_ms,
                    :is_healthy, :error_msg, NOW()
                )
            """), r)

        c.execute(text("""
            INSERT INTO api_gateway_settings (key, value, updated_at)
            VALUES ('last_health_check', to_jsonb(NOW()::text), NOW())
            ON CONFLICT (key) DO UPDATE
                SET value = EXCLUDED.value, updated_at = NOW()
        """))

    duration_ms = int((time.perf_counter() - t_start) * 1000)
    return {
        "ok": True,
        "summary": {"total": len(results), "healthy": healthy, "failed": failed},
        "duration_ms": duration_ms,
    }


# ─── GET / PUT /api/platform/gateway/health-settings ─────────────────
@router.get("/health-settings")
def get_health_settings(authorization: str = Header(None)):
    _admin_auth(authorization)
    with engine.connect() as c:
        v = c.execute(text("""
            SELECT value FROM api_gateway_settings WHERE key = 'health_check_interval_min'
        """)).scalar()
    interval = 60
    if v is not None:
        try:
            import json
            parsed = json.loads(v) if isinstance(v, str) else v
            interval = int(parsed) if parsed is not None else 60
        except Exception:
            interval = 60
    return {"interval_min": interval}


class HealthSettingsBody(BaseModel):
    interval_min: int


@router.put("/health-settings")
def update_health_settings(body: HealthSettingsBody, authorization: str = Header(None)):
    payload = _admin_auth(authorization)
    if body.interval_min < 1 or body.interval_min > 1440:
        raise HTTPException(400, "interval_min ต้องอยู่ระหว่าง 1 ถึง 1440")
    with engine.begin() as c:
        c.execute(text("""
            INSERT INTO api_gateway_settings (key, value, updated_at, updated_by)
            VALUES ('health_check_interval_min', to_jsonb(:val::int), NOW(), :by)
            ON CONFLICT (key) DO UPDATE
                SET value = EXCLUDED.value,
                    updated_at = NOW(),
                    updated_by = EXCLUDED.updated_by
        """), {
            "val": body.interval_min,
            "by": payload.get("email") or payload.get("sub") or "platform_admin",
        })
    return {"ok": True}


# ─── GET /api/platform/gateway/quota-status ──────────────────────────
# Tenant-facing: returns current/limit for member + product quotas.
# Uses tenant JWT (viiv_token) — NOT platform admin token.
def _tenant_auth(authorization: str | None) -> str:
    """Decode tenant JWT and resolve tenant_id (mirrors tenant_settings._resolve_tenant)."""
    if not authorization:
        raise HTTPException(401, "missing token")
    try:
        tok = authorization.replace("Bearer ", "").strip()
        if not tok:
            raise HTTPException(401, "missing token")
        payload = jwt.decode(tok, JWT_SECRET, algorithms=["HS256"],
                             options={"leeway": 864000, "verify_exp": False})
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(401, "invalid token")
    tid = payload.get("tenant_id")
    if tid:
        return tid
    sub = payload.get("sub")
    if sub:
        with engine.connect() as c:
            r = c.execute(text(
                "SELECT tenant_id FROM tenant_staff WHERE id=:id LIMIT 1"
            ), {"id": sub}).fetchone()
            if r and r[0]:
                return r[0]
            email = payload.get("email")
            if email:
                r = c.execute(text(
                    "SELECT id FROM tenants WHERE email=:e LIMIT 1"
                ), {"e": email}).fetchone()
                if r:
                    return r[0]
    raise HTTPException(401, "no tenant for token")


@router.get("/quota-status")
def quota_status(authorization: str = Header(None)):
    tid = _tenant_auth(authorization)
    with engine.connect() as c:
        r = c.execute(text("""
            SELECT p.name, p.max_members, p.max_products
              FROM tenants t
              JOIN packages p ON p.id = t.package_id
             WHERE t.id = :tid
             LIMIT 1
        """), {"tid": tid}).fetchone()
        if not r:
            raise HTTPException(404, "tenant or package not found")
        pkg_name, max_m, max_p = r[0], r[1], r[2]
        member_count = c.execute(text(
            "SELECT COUNT(*) FROM members WHERE tenant_id=:tid AND deleted_at IS NULL"
        ), {"tid": tid}).scalar() or 0
        partner_count = c.execute(text(
            "SELECT COUNT(*) FROM partners WHERE tenant_id=:tid"
        ), {"tid": tid}).scalar() or 0
        members_total = member_count + partner_count
        product_count = c.execute(text(
            "SELECT COUNT(*) FROM products WHERE tenant_id=:tid AND status='active'"
        ), {"tid": tid}).scalar() or 0
        affiliate_count = c.execute(text(
            "SELECT COUNT(*) FROM affiliate_products WHERE tenant_id=:tid AND status='active'"
        ), {"tid": tid}).scalar() or 0
        products_total = product_count + affiliate_count

    def _block(current: int, limit):
        cur = int(current or 0)
        lim = int(limit) if limit is not None else -1
        if lim < 0:
            return {"current": cur, "limit": -1, "remaining": None}
        return {"current": cur, "limit": lim, "remaining": max(0, lim - cur)}

    return {
        "package_name": pkg_name,
        "members": _block(members_total, max_m),
        "products": _block(products_total, max_p),
    }
