# app/middleware/gateway.py — Phase 2E
# Decorators for credit deduction + quota gating on protected endpoints.
#
# Pattern: sync SQLAlchemy + JWT header auth (mirrors api_gateway.py / pos_*.py)
# Dual mode: wraps both `def` and `async def` endpoints (FastAPI accepts both).
#
# Usage:
#   from app.middleware.gateway import require_credit, require_quota
#
#   @router.post("/something")
#   @require_credit('chat_text')
#   def something(payload: dict, authorization: str = Header("")):
#       ...
#
#   @router.post("/members/create")
#   @require_quota('max_members')
#   def create_member(payload: dict, authorization: str = Header("")):
#       ...
#
# Notes
# - feature_flags ใน packages ไม่มี `quota` object → quota fields อ่านจาก
#   top-level columns (max_members, max_products, credit_monthly).
# - Refund (D68): action ที่ fail หลังหัก credit แล้ว → คืนเข้า credit_topup.
# - Low credit alert: ถ้า total_remaining <= threshold → response.headers
#   X-Credit-Warning=low + X-Credit-Remaining + X-Credit-Threshold.

import os
import json
import asyncio
import inspect
from functools import wraps

import jwt
from fastapi import HTTPException, Request
from sqlalchemy import text

from app.core.db import engine

JWT_SECRET = os.getenv(
    "JWT_SECRET",
    "21cc8b2ff8e25e6262effb2b47b15c39fb16438525b6d041bb842a130c08be7c",
)

LOW_CREDIT_THRESHOLD_PCT = 20  # Phase 3: read from api_gateway_settings


# ───────────────────────────── helpers ──────────────────────────────

def _decode_token(authorization: str | None) -> dict | None:
    if not authorization:
        return None
    try:
        tok = authorization.replace("Bearer ", "").strip()
        if not tok:
            return None
        return jwt.decode(
            tok, JWT_SECRET, algorithms=["HS256"],
            options={"leeway": 864000, "verify_exp": False},
        )
    except Exception:
        return None


def _resolve_tenant_id(payload: dict, conn) -> str | None:
    """Mirrors tenant_settings._resolve_tenant — JWT → staff lookup → email lookup."""
    tid = payload.get("tenant_id")
    if tid:
        return tid
    sub = payload.get("sub")
    if sub:
        r = conn.execute(
            text("SELECT tenant_id FROM tenant_staff WHERE id=:id LIMIT 1"),
            {"id": sub},
        ).fetchone()
        if r and r[0]:
            return r[0]
    email = payload.get("email")
    if email:
        r = conn.execute(
            text("SELECT id FROM tenants WHERE email=:e LIMIT 1"),
            {"e": email},
        ).fetchone()
        if r:
            return r[0]
    return None


def _get_package(tenant_id: str, conn) -> dict:
    """Read package row joined to tenant. Returns {} if not found."""
    r = conn.execute(text("""
        SELECT p.id, p.name, p.feature_flags, p.credit_monthly,
               p.max_members, p.max_products
          FROM tenants t
          JOIN packages p ON p.id = t.package_id
         WHERE t.id = :tid
         LIMIT 1
    """), {"tid": tenant_id}).fetchone()
    if not r:
        return {}
    m = dict(r._mapping)
    ff = m.get("feature_flags") or {}
    if isinstance(ff, str):
        try:
            ff = json.loads(ff)
        except Exception:
            ff = {}
    m["feature_flags"] = ff
    return m


def _get_credit_balance(tenant_id: str, conn) -> dict:
    r = conn.execute(text("""
        SELECT credit_subscription, credit_rollover, credit_topup
          FROM ai_tenant_credits
         WHERE tenant_id = :tid
         LIMIT 1
    """), {"tid": tenant_id}).fetchone()
    if not r:
        return {"sub": 0, "rollover": 0, "topup": 0, "total": 0}
    sub = int(r[0] or 0)
    roll = int(r[1] or 0)
    top = int(r[2] or 0)
    return {"sub": sub, "rollover": roll, "topup": top, "total": sub + roll + top}


def _get_action_cost(action_key: str, conn) -> int | None:
    """Returns cost (>=0) if action_key exists and is_active=true. None otherwise."""
    r = conn.execute(text("""
        SELECT cost FROM credit_pricing
         WHERE action_key = :k AND is_active = true
         LIMIT 1
    """), {"k": action_key}).fetchone()
    if not r:
        return None
    return int(r[0] or 0)


def _deduct_credit(tenant_id: str, action_key: str, cost: int, conn) -> int | None:
    """
    Atomic deduct in pool order Sub → Rollover → Topup.
    Caller must pass `conn` from `engine.begin()` (txn) so SELECT FOR UPDATE
    locks the row until commit.
    Returns ledger_id, or None if balance insufficient.
    """
    r = conn.execute(text("""
        SELECT credit_subscription, credit_rollover, credit_topup
          FROM ai_tenant_credits
         WHERE tenant_id = :tid
         FOR UPDATE
    """), {"tid": tenant_id}).fetchone()
    if not r:
        # No credit row → treat as zero balance
        return None

    sub = int(r[0] or 0)
    roll = int(r[1] or 0)
    top = int(r[2] or 0)
    total = sub + roll + top
    if total < cost:
        return None

    sub_deduct = min(cost, sub)
    rem = cost - sub_deduct
    roll_deduct = min(rem, roll)
    rem -= roll_deduct
    top_deduct = rem  # remaining always <= top thanks to total>=cost check

    conn.execute(text("""
        UPDATE ai_tenant_credits SET
            credit_subscription = credit_subscription - :sd,
            credit_rollover     = credit_rollover     - :rd,
            credit_topup        = credit_topup        - :td,
            credit_used         = COALESCE(credit_used, 0) + :cost,
            updated_at          = now()
         WHERE tenant_id = :tid
    """), {"sd": sub_deduct, "rd": roll_deduct, "td": top_deduct,
           "cost": cost, "tid": tenant_id})

    new_total = total - cost
    meta = json.dumps({
        "sub_deduct": sub_deduct,
        "rollover_deduct": roll_deduct,
        "topup_deduct": top_deduct,
    })
    row = conn.execute(text("""
        INSERT INTO credit_ledger
            (tenant_id, txn_type, action_key, amount, balance_after,
             source, created_by, metadata)
        VALUES
            (:tid, 'consume', :ak, :amt, :bal,
             'api', 'system', CAST(:meta AS jsonb))
        RETURNING id
    """), {"tid": tenant_id, "ak": action_key,
           "amt": -cost, "bal": new_total, "meta": meta}).fetchone()
    return int(row[0]) if row else None


def try_consume_credit(tenant_id: str, action_key: str) -> tuple[bool, int | None, int]:
    """
    Public helper for background workers (e.g. LINE bot push reply) that don't
    have a FastAPI request to attach a decorator to.

    Returns (ok, ledger_id, cost):
      - ok=True, ledger_id=<int>, cost=<int>      → credit deducted; caller MUST
                                                    refund_credit() on failure.
      - ok=True, ledger_id=None, cost=0           → free action (no pricing row
                                                    or cost==0); no refund needed.
      - ok=False, ledger_id=None, cost=<required> → insufficient balance; caller
                                                    should skip the action.
    """
    if not tenant_id:
        return (False, None, 0)
    with engine.connect() as c:
        cost = _get_action_cost(action_key, c)
    if not cost:
        return (True, None, 0)
    with engine.begin() as c:
        ledger_id = _deduct_credit(tenant_id, action_key, cost, c)
    if ledger_id is None:
        return (False, None, cost)
    return (True, ledger_id, cost)


def refund_credit(tenant_id: str, ledger_id: int, cost: int,
                  action_key: str = "") -> None:
    """Public alias for _refund_credit — exported for background workers."""
    _refund_credit(tenant_id, ledger_id, cost, action_key)


def _refund_credit(tenant_id: str, ledger_id: int, cost: int, action_key: str) -> None:
    """
    D68: refund failed action → credit_topup pool.
    Runs in its own txn (called outside the request txn).
    """
    try:
        with engine.begin() as c:
            r = c.execute(text("""
                UPDATE ai_tenant_credits
                   SET credit_topup = credit_topup + :amt,
                       credit_used  = GREATEST(COALESCE(credit_used,0) - :amt, 0),
                       updated_at   = now()
                 WHERE tenant_id = :tid
             RETURNING credit_subscription + credit_rollover + credit_topup
            """), {"amt": cost, "tid": tenant_id}).fetchone()
            new_total = int(r[0]) if r else cost
            c.execute(text("""
                INSERT INTO credit_ledger
                    (tenant_id, txn_type, action_key, amount, balance_after,
                     source, reference_id, created_by)
                VALUES
                    (:tid, 'refund', :ak, :amt, :bal,
                     'api', :ref, 'system')
            """), {"tid": tenant_id, "ak": action_key,
                   "amt": cost, "bal": new_total, "ref": str(ledger_id)})
    except Exception:
        # Best effort — don't mask the original error path
        pass


def _low_credit_check(remaining: int, monthly: int) -> tuple[bool, int]:
    """
    Returns (is_low, threshold). monthly==0 → use 5000 default so banner still
    works for tenants whose package has no credit_monthly set yet.
    """
    base = monthly if monthly and monthly > 0 else 5000
    threshold = int(base * LOW_CREDIT_THRESHOLD_PCT / 100)
    return (remaining <= threshold, threshold)


def _resolve_request(args, kwargs) -> Request | None:
    req = kwargs.get("request")
    if isinstance(req, Request):
        return req
    for a in args:
        if isinstance(a, Request):
            return a
    return None


def _resolve_authorization(args, kwargs, request: Request | None) -> str:
    auth = kwargs.get("authorization")
    if isinstance(auth, str) and auth:
        return auth
    if request is not None:
        return request.headers.get("authorization", "") or ""
    return ""


def _attach_low_credit_headers(response, remaining: int, threshold: int):
    if response is None or not hasattr(response, "headers"):
        return
    try:
        response.headers["X-Credit-Warning"] = "low"
        response.headers["X-Credit-Remaining"] = str(remaining)
        response.headers["X-Credit-Threshold"] = str(threshold)
    except Exception:
        pass


# ─────────────────────────── require_credit ─────────────────────────

def require_credit(action_key: str):
    """
    Deduct credit before running the handler. Refund on failure (D68).

    - 401 if no/invalid token.
    - 402 if credit insufficient (with topup_url + message).
    - If credit_pricing row missing OR cost==0 → pass through (free action).
    """
    def decorator(func):
        is_async = inspect.iscoroutinefunction(func)

        def _resolve_context(args, kwargs):
            request = _resolve_request(args, kwargs)
            authorization = _resolve_authorization(args, kwargs, request)
            payload = _decode_token(authorization)
            if not payload:
                raise HTTPException(401, "Unauthorized")
            with engine.connect() as c:
                tid = _resolve_tenant_id(payload, c)
                if not tid:
                    raise HTTPException(401, "no tenant for token")
                cost = _get_action_cost(action_key, c)
                pkg = _get_package(tid, c)
            return tid, cost, pkg

        def _do_deduct_or_402(tid: str, cost: int) -> int:
            with engine.begin() as c:
                ledger_id = _deduct_credit(tid, action_key, cost, c)
            if ledger_id is None:
                with engine.connect() as c:
                    bal = _get_credit_balance(tid, c)
                raise HTTPException(402, {
                    "error": "insufficient_credit",
                    "required": cost,
                    "current_balance": bal["total"],
                    "action": action_key,
                    "topup_url": "/superboard/pages/topup.html",
                    "message": "เครดิตไม่เพียงพอ กรุณาเติมเครดิตเพื่อใช้งานต่อ",
                })
            return ledger_id

        def _post_check_low(tid: str, pkg: dict, response):
            try:
                with engine.connect() as c:
                    bal = _get_credit_balance(tid, c)
                monthly = int((pkg or {}).get("credit_monthly") or 0)
                is_low, thr = _low_credit_check(bal["total"], monthly)
                if is_low:
                    _attach_low_credit_headers(response, bal["total"], thr)
            except Exception:
                pass

        if is_async:
            @wraps(func)
            async def awrapper(*args, **kwargs):
                tid, cost, pkg = _resolve_context(args, kwargs)
                if not cost:  # None or 0 → free
                    return await func(*args, **kwargs)
                ledger_id = _do_deduct_or_402(tid, cost)
                try:
                    response = await func(*args, **kwargs)
                except HTTPException:
                    _refund_credit(tid, ledger_id, cost, action_key)
                    raise
                except Exception:
                    _refund_credit(tid, ledger_id, cost, action_key)
                    raise
                _post_check_low(tid, pkg, response)
                return response
            return awrapper

        @wraps(func)
        def swrapper(*args, **kwargs):
            tid, cost, pkg = _resolve_context(args, kwargs)
            if not cost:
                return func(*args, **kwargs)
            ledger_id = _do_deduct_or_402(tid, cost)
            try:
                response = func(*args, **kwargs)
            except HTTPException:
                _refund_credit(tid, ledger_id, cost, action_key)
                raise
            except Exception:
                _refund_credit(tid, ledger_id, cost, action_key)
                raise
            _post_check_low(tid, pkg, response)
            return response
        return swrapper
    return decorator


# ─────────────────────────── require_quota ──────────────────────────

# quota field → (table, tenant_col, where_active)
QUOTA_TABLES = {
    "max_members":  ("members",  "tenant_id", "deleted_at IS NULL"),
    "max_products": ("products", "tenant_id", "status = 'active'"),
}


def require_quota(quota_field: str):
    """
    Block creation when current count >= packages.{quota_field}.
    null or <0 → unlimited (pass).
    """
    def decorator(func):
        is_async = inspect.iscoroutinefunction(func)

        def _resolve_context(args, kwargs):
            request = _resolve_request(args, kwargs)
            authorization = _resolve_authorization(args, kwargs, request)
            payload = _decode_token(authorization)
            if not payload:
                raise HTTPException(401, "Unauthorized")
            with engine.connect() as c:
                tid = _resolve_tenant_id(payload, c)
                if not tid:
                    raise HTTPException(401, "no tenant for token")
                pkg = _get_package(tid, c)
            return tid, pkg

        def _enforce(tid: str, pkg: dict):
            limit = pkg.get(quota_field) if pkg else None
            if limit is None or int(limit) < 0:
                return  # unlimited
            limit = int(limit)
            spec = QUOTA_TABLES.get(quota_field)
            if not spec:
                return  # unknown quota → don't block
            table, col, active_where = spec
            sql = f"SELECT COUNT(*) FROM {table} WHERE {col}=:tid AND {active_where}"
            with engine.connect() as c:
                cur = c.execute(text(sql), {"tid": tid}).scalar() or 0
            cur = int(cur)
            if cur >= limit:
                raise HTTPException(402, {
                    "error": "quota_exceeded",
                    "field": quota_field,
                    "current": cur,
                    "limit": limit,
                    "message": f"เกินจำนวนที่แพ็กเกจกำหนด ({cur}/{limit}) กรุณาอัปเกรดแพ็กเกจ",
                    "upgrade_url": "/superboard/pages/upgrade.html",
                })

        if is_async:
            @wraps(func)
            async def awrapper(*args, **kwargs):
                tid, pkg = _resolve_context(args, kwargs)
                _enforce(tid, pkg)
                return await func(*args, **kwargs)
            return awrapper

        @wraps(func)
        def swrapper(*args, **kwargs):
            tid, pkg = _resolve_context(args, kwargs)
            _enforce(tid, pkg)
            return func(*args, **kwargs)
        return swrapper
    return decorator
