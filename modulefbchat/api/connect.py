"""
modulefbchat/api/connect.py — Production-grade FB connection endpoints.

POST   /api/fbchat/connect     — cookie login → mautrix → UPSERT fb_sessions
GET    /api/fbchat/status      — connection status for tenant
DELETE /api/fbchat/disconnect  — mautrix logout + clear session
"""
from __future__ import annotations

import json
import logging

import httpx
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel

from ..auth import verify_tenant_token
from ..crypto import encrypt_session
from ..matrix_admin import register_matrix_user
from ..mautrix_client import (
    list_logins,
    logout as mautrix_logout,
    mxid_for_tenant,
    start_login,
    submit_cookies,
)

log = logging.getLogger("modulefbchat.api.connect")

router = APIRouter()

ADMIN_ROLES = {"owner", "md", "shop_admin", "admin"}


def _require_admin(claims: dict) -> str:
    """Validate role in ADMIN_ROLES (case-insensitive). Return tenant_id."""
    role = (claims.get("role") or "").lower()
    if role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Forbidden: admin role required")
    tenant_id = claims.get("tenant_id", "")
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return tenant_id


class ConnectBody(BaseModel):
    xs: str
    c_user: str
    datr: str


@router.post("/connect")
async def fb_connect(
    body: ConnectBody,
    request: Request,
    authorization: str = Header(""),
):
    """POST /api/fbchat/connect — login via FB cookies, save to fb_sessions."""
    # 1. Auth + role gate
    claims = verify_tenant_token(authorization)
    tenant_id = _require_admin(claims)

    # 2. Non-empty check (Pydantic guarantees presence; this catches blank strings)
    if not body.xs.strip() or not body.c_user.strip() or not body.datr.strip():
        raise HTTPException(status_code=400, detail="xs, c_user, datr must not be empty")

    db = request.app.state.db

    # 3. Verify tenant exists
    tenant = await db.fetch_one(
        "SELECT id FROM tenants WHERE id = :tid",
        {"tid": tenant_id},
    )
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # 4. Ensure Matrix user registered (idempotent — M_USER_IN_USE is OK)
    mxid = mxid_for_tenant(tenant_id)
    session_row = await db.fetch_one(
        "SELECT matrix_user_id FROM fb_sessions WHERE tenant_id = :tid",
        {"tid": tenant_id},
    )
    if not session_row or not session_row.get("matrix_user_id"):
        try:
            reg = await register_matrix_user(tenant_id)
            log.info(
                "Matrix user provisioned mxid=%s is_new=%s",
                reg["mxid"], reg.get("is_new"),
            )
        except httpx.ConnectError as exc:
            raise HTTPException(status_code=502, detail=f"Synapse unreachable: {exc}")
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Matrix registration failed: {exc}")

    # 5. Start mautrix login flow
    try:
        step_data = await start_login(mxid)
    except httpx.ConnectError as exc:
        raise HTTPException(status_code=502, detail=f"mautrix-meta unreachable: {exc}")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"mautrix start_login failed: HTTP {exc.response.status_code}",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"start_login error: {exc}")

    login_id = step_data.get("login_id")
    step_id = step_data.get("step_id", "fi.mau.meta.cookies")

    if not login_id:
        raise HTTPException(status_code=502, detail="mautrix returned no login_id")

    # 6. Submit FB cookies
    cookies_dict = {"xs": body.xs, "c_user": body.c_user, "datr": body.datr}
    try:
        result = await submit_cookies(mxid, login_id, step_id, cookies_dict)
    except httpx.ConnectError as exc:
        raise HTTPException(status_code=502, detail=f"mautrix-meta unreachable: {exc}")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"FB login failed (invalid/expired cookies): HTTP {exc.response.status_code}",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"submit_cookies error: {exc}")

    if result.get("type") != "complete":
        raise HTTPException(
            status_code=422,
            detail=f"Unexpected login step '{result.get('type')}' — cookies may require 2FA",
        )

    # Extract FB user info from completion response
    user_login = result.get("user_login") or {}
    fb_user_id = str(
        user_login.get("id") or result.get("fb_user_id") or ""
    )
    fb_user_name = str(
        user_login.get("name") or result.get("fb_user_name") or ""
    )

    # 7. Encrypt cookies for at-rest storage
    try:
        session_encrypted = encrypt_session(json.dumps(cookies_dict))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Encryption failed: {exc}")

    # 8. UPSERT fb_sessions
    try:
        await db.execute(
            """
            INSERT INTO fb_sessions (
                tenant_id, fb_user_id, fb_user_name, status,
                session_data_encrypted, matrix_user_id,
                last_login_at, updated_at
            ) VALUES (
                :tenant_id, :fb_user_id, :fb_user_name, 'active',
                :session_encrypted, :mxid,
                NOW(), NOW()
            )
            ON CONFLICT (tenant_id) DO UPDATE SET
                fb_user_id             = EXCLUDED.fb_user_id,
                fb_user_name           = EXCLUDED.fb_user_name,
                status                 = 'active',
                session_data_encrypted = EXCLUDED.session_data_encrypted,
                matrix_user_id         = EXCLUDED.matrix_user_id,
                last_login_at          = NOW(),
                updated_at             = NOW()
            """,
            {
                "tenant_id": tenant_id,
                "fb_user_id": fb_user_id,
                "fb_user_name": fb_user_name,
                "session_encrypted": session_encrypted,
                "mxid": mxid,
            },
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"DB error: {exc}")

    log.info(
        "FB connect success tenant_id=%s fb_user_id=%s fb_user_name=%s",
        tenant_id, fb_user_id, fb_user_name,
    )
    return {
        "success": True,
        "fb_user_id": fb_user_id,
        "fb_user_name": fb_user_name,
        "tenant_id": tenant_id,
    }


@router.get("/status")
async def fb_status(
    request: Request,
    authorization: str = Header(""),
):
    """GET /api/fbchat/status — connection status for this tenant."""
    claims = verify_tenant_token(authorization)
    tenant_id = claims.get("tenant_id", "")
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    db = request.app.state.db
    row = await db.fetch_one(
        """
        SELECT tenant_id, fb_user_id, fb_user_name, status,
               last_login_at, last_active_at
        FROM fb_sessions
        WHERE tenant_id = :tid
        """,
        {"tid": tenant_id},
    )

    if not row:
        return {"connected": False}

    return {
        "connected": True,
        "fb_user_id": row.get("fb_user_id") or "",
        "fb_user_name": row.get("fb_user_name") or "",
        "status": row.get("status") or "pending",
        "last_login_at": (
            row["last_login_at"].isoformat() if row.get("last_login_at") else None
        ),
        "last_active_at": (
            row["last_active_at"].isoformat() if row.get("last_active_at") else None
        ),
    }


@router.delete("/disconnect")
async def fb_disconnect(
    request: Request,
    authorization: str = Header(""),
):
    """DELETE /api/fbchat/disconnect — mautrix logout + clear session data."""
    claims = verify_tenant_token(authorization)
    tenant_id = _require_admin(claims)

    db = request.app.state.db
    row = await db.fetch_one(
        "SELECT fb_user_id, matrix_user_id FROM fb_sessions WHERE tenant_id = :tid",
        {"tid": tenant_id},
    )

    if not row:
        raise HTTPException(status_code=404, detail="No FB session found for this tenant")

    mxid = row.get("matrix_user_id") or mxid_for_tenant(tenant_id)
    fb_user_id = row.get("fb_user_id") or ""

    # Attempt mautrix logout (best-effort — DB update always follows regardless)
    mautrix_warning: str | None = None
    if fb_user_id and mxid:
        try:
            login_ids = await list_logins(mxid)
            if fb_user_id in login_ids:
                await mautrix_logout(mxid, fb_user_id)
                log.info(
                    "mautrix logout ok tenant_id=%s fb_user_id=%s", tenant_id, fb_user_id
                )
            else:
                log.info(
                    "fb_user_id=%s not in active logins for mxid=%s — skipping mautrix logout",
                    fb_user_id, mxid,
                )
        except httpx.ConnectError as exc:
            mautrix_warning = f"mautrix-meta unreachable: {exc}"
            log.warning("disconnect: mautrix unreachable — continuing with DB update: %s", exc)
        except Exception as exc:
            mautrix_warning = str(exc)
            log.warning("disconnect: mautrix logout failed — continuing: %s", exc)

    # Always update DB
    try:
        await db.execute(
            """
            UPDATE fb_sessions
            SET status                 = 'disconnected',
                session_data_encrypted = NULL,
                updated_at             = NOW()
            WHERE tenant_id = :tid
            """,
            {"tid": tenant_id},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"DB error: {exc}")

    log.info("FB disconnect done tenant_id=%s", tenant_id)
    response: dict = {"success": True}
    if mautrix_warning:
        response["warning"] = f"DB cleared but mautrix logout failed: {mautrix_warning}"
    return response
