# platform_ai.py — Platform AI key/credit/stats management
# Adapted to codebase pattern: sync SQLAlchemy + JWT header auth (no Depends/get_db)
# Credits stored in ai_tenant_credits (separate table — tenants is owned by supabase_admin)

import os, jwt
from typing import Optional
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
import httpx

from app.core.db import engine

router = APIRouter(prefix="/ai", tags=["platform-ai"])

JWT_SECRET = os.getenv("JWT_SECRET", "21cc8b2ff8e25e6262effb2b47b15c39fb16438525b6d041bb842a130c08be7c")

COST_PER_TOKEN = {
    "claude-haiku-4-5":    {"input": 0.00000025, "output": 0.00000125},
    "claude-sonnet-4-6":   {"input": 0.000003,   "output": 0.000015},
    "claude-sonnet-4-7":   {"input": 0.000003,   "output": 0.000015},
    "gpt-4o-mini":         {"input": 0.00000015, "output": 0.0000006},
    "gpt-4o":              {"input": 0.000005,   "output": 0.000015},
    "gemini-1.5-flash":    {"input": 0.000000075,"output": 0.0000003},
    "deepseek-chat":       {"input": 0.00000014, "output": 0.00000028},
    "deepseek-reasoner":   {"input": 0.00000055, "output": 0.00000219},
}

ALLOWED_PROVIDERS = ("anthropic", "openai", "google", "deepseek")


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


# ─── GET /api/platform/ai/keys ───────────────────────────────────────
@router.get("/keys")
def get_keys(authorization: str = Header(None)):
    _admin_auth(authorization)
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT provider,
                   left(api_key,8)||'...'||right(api_key,4) AS masked,
                   is_active, updated_at
            FROM ai_api_keys ORDER BY provider
        """)).mappings().all()
    return {"keys": [dict(r) for r in rows]}


# ─── POST /api/platform/ai/keys ──────────────────────────────────────
class KeyBody(BaseModel):
    provider: str   # anthropic | openai | google | deepseek
    api_key: str

@router.post("/keys")
def save_key(body: KeyBody, authorization: str = Header(None)):
    _admin_auth(authorization)
    prov = (body.provider or "").strip().lower()
    if prov not in ALLOWED_PROVIDERS:
        raise HTTPException(400, f"Invalid provider. Allowed: {', '.join(ALLOWED_PROVIDERS)}")
    with engine.begin() as c:
        c.execute(text("""
            INSERT INTO ai_api_keys (provider, api_key)
            VALUES (:p, :k)
            ON CONFLICT (provider) DO UPDATE
              SET api_key=EXCLUDED.api_key, updated_at=now()
        """), {"p": prov, "k": body.api_key})
    return {"ok": True}


# ─── DELETE /api/platform/ai/keys/{provider} ─────────────────────────
@router.delete("/keys/{provider}")
def delete_key(provider: str, authorization: str = Header(None)):
    _admin_auth(authorization)
    with engine.begin() as c:
        c.execute(text("DELETE FROM ai_api_keys WHERE provider=:p"), {"p": provider})
    return {"ok": True}


# ─── GET /api/platform/ai/stats ──────────────────────────────────────
@router.get("/stats")
async def get_stats(authorization: str = Header(None)):
    _admin_auth(authorization)
    with engine.connect() as c:
        today = c.execute(text("""
            SELECT COALESCE(SUM(total_tokens),0) AS tokens,
                   COALESCE(SUM(cost_usd),0)     AS cost,
                   COUNT(*)                       AS calls
            FROM ai_token_log
            WHERE created_at >= date_trunc('day', now())
        """)).mappings().first()

        month = c.execute(text("""
            SELECT COALESCE(SUM(total_tokens),0) AS tokens,
                   COALESCE(SUM(cost_usd),0)     AS cost,
                   COUNT(*)                       AS calls
            FROM ai_token_log
            WHERE created_at >= date_trunc('month', now())
        """)).mappings().first()

        by_model = c.execute(text("""
            SELECT model,
                   SUM(input_tokens)  AS input,
                   SUM(output_tokens) AS output,
                   SUM(total_tokens)  AS total,
                   SUM(cost_usd)      AS cost,
                   COUNT(*)           AS calls
            FROM ai_token_log
            WHERE created_at >= date_trunc('month', now())
            GROUP BY model ORDER BY total DESC
        """)).mappings().all()

        by_tenant = c.execute(text("""
            SELECT t.id AS tenant_id, t.store_name, t.subdomain,
                   SUM(l.total_tokens)            AS total,
                   SUM(l.cost_usd)                AS cost,
                   COALESCE(cr.credit_total, 0)   AS credit_total,
                   COALESCE(cr.credit_used, 0)    AS credit_used
            FROM ai_token_log l
            JOIN tenants t              ON t.id = l.tenant_id
            LEFT JOIN ai_tenant_credits cr ON cr.tenant_id = t.id
            WHERE l.created_at >= date_trunc('month', now())
            GROUP BY t.id, t.store_name, t.subdomain, cr.credit_total, cr.credit_used
            ORDER BY total DESC LIMIT 10
        """)).mappings().all()

    ai_status = "unknown"
    try:
        async with httpx.AsyncClient(timeout=2) as client:
            r = await client.get("http://localhost:8002/health")
            ai_status = "online" if r.status_code == 200 else "error"
    except Exception:
        ai_status = "offline"

    return {
        "today":     {"tokens": int(today["tokens"]), "cost": float(today["cost"]), "calls": int(today["calls"])},
        "month":     {"tokens": int(month["tokens"]), "cost": float(month["cost"]), "calls": int(month["calls"])},
        "by_model":  [dict(r) for r in by_model],
        "by_tenant": [dict(r) for r in by_tenant],
        "ai_status": ai_status,
    }


# ─── GET /api/platform/ai/log ────────────────────────────────────────
@router.get("/log")
def get_log(limit: int = 50, authorization: str = Header(None)):
    _admin_auth(authorization)
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT l.id, l.provider, l.model, l.source,
                   l.input_tokens, l.output_tokens, l.total_tokens,
                   l.cost_usd, l.created_at,
                   t.store_name, t.subdomain
            FROM ai_token_log l
            LEFT JOIN tenants t ON t.id = l.tenant_id
            ORDER BY l.created_at DESC LIMIT :lim
        """), {"lim": limit}).mappings().all()
    return {"log": [dict(r) for r in rows]}


# ─── PATCH /api/platform/ai/credit/{tenant_id} ───────────────────────
class CreditBody(BaseModel):
    credit_total: int

@router.patch("/credit/{tenant_id}")
def set_credit(tenant_id: str, body: CreditBody, authorization: str = Header(None)):
    _admin_auth(authorization)
    with engine.begin() as c:
        c.execute(text("""
            INSERT INTO ai_tenant_credits (tenant_id, credit_total, updated_at)
            VALUES (:tid, :c, now())
            ON CONFLICT (tenant_id) DO UPDATE
              SET credit_total = EXCLUDED.credit_total,
                  updated_at   = now()
        """), {"c": body.credit_total, "tid": tenant_id})
    return {"ok": True}


# ─── GET /api/platform/ai/models ─────────────────────────────────────
@router.get("/models")
def get_models(authorization: str = Header(None)):
    _admin_auth(authorization)
    return {
        "models": [
            {"id": "gpt-5-nano",     "provider": "openai",   "in": 0.05, "out": 0.40, "default": True,  "active": True},
            {"id": "gpt-5.4-nano",   "provider": "openai",   "in": 0.20, "out": 1.25, "default": False, "active": False},
            {"id": "gpt-4o-mini",    "provider": "openai",   "in": 0.15, "out": 0.60, "default": False, "active": False},
            {"id": "deepseek-chat",  "provider": "deepseek", "in": 0.14, "out": 0.28, "default": False, "active": False},
        ],
        "locked": True,
        "locked_reason": "test mode — single model",
    }


# ─── GET /api/platform/ai/health-proxy ───────────────────────────────
@router.get("/health-proxy")
def get_ai_health(authorization: str = Header(None)):
    _admin_auth(authorization)
    try:
        with httpx.Client(timeout=3.0) as client:
            r = client.get("http://localhost:8002/health")
        if r.status_code != 200:
            return {"status": "offline", "reason": f"http_{r.status_code}"}
        data = r.json()
        if data.get("key_loaded"):
            return {
                "status": "online",
                "model": data.get("model", "gpt-5-nano"),
                "provider": data.get("provider", "openai"),
            }
        return {"status": "stub", "reason": "no_api_key"}
    except httpx.TimeoutException:
        return {"status": "offline", "reason": "timeout"}
    except (httpx.ConnectError, httpx.RequestError):
        return {"status": "offline", "reason": "moduleai_down"}
    except Exception as e:
        return {"status": "offline", "reason": f"error:{type(e).__name__}"}
