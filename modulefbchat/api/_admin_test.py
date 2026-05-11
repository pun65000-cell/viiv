"""
modulefbchat/api/_admin_test.py — Dev-only admin test endpoints.
"""
from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..matrix_admin import register_matrix_user, verify_access_token
from ..mautrix_client import (
    mxid_for_tenant,
    whoami as mautrix_whoami,
    get_login_flows,
    list_logins,
    start_login,
    submit_cookies,
    logout as mautrix_logout,
)

router = APIRouter(prefix="/api/fbchat/_admin_test", tags=["fbchat-admin-test"])

_VALID_PREFIXES = ("ten_", "test_", "stf_")


def _dev_guard(dev: int) -> None:
    if os.getenv("VIIV_DEV_MODE") == "1":
        return
    if dev == 1:
        return
    raise HTTPException(status_code=404, detail="Not Found")


@router.post("/register")
async def admin_test_register(
    tenant_id: str = Query(..., description="target tenant_id"),
    dev: int = Query(0),
):
    """Register a Matrix user for tenant_id (dev only)."""
    _dev_guard(dev)
    if not any(tenant_id.startswith(p) for p in _VALID_PREFIXES):
        raise HTTPException(400, "invalid tenant_id format")
    try:
        result = await register_matrix_user(tenant_id)
        return result
    except Exception as e:
        raise HTTPException(500, f"register failed: {e}")


@router.get("/whoami")
async def admin_test_whoami(
    token: str = Query(..., description="Matrix access token"),
    dev: int = Query(0),
):
    """Verify a Matrix access token via Synapse whoami (dev only)."""
    _dev_guard(dev)
    try:
        return await verify_access_token(token)
    except Exception as e:
        raise HTTPException(500, f"whoami failed: {e}")


@router.get("/mautrix/whoami")
async def admin_test_mautrix_whoami(
    tenant_id: str = Query(..., description="target tenant_id"),
    dev: int = Query(0),
):
    """mautrix GET /v3/whoami for tenant MXID (dev only)."""
    _dev_guard(dev)
    if not any(tenant_id.startswith(p) for p in _VALID_PREFIXES):
        raise HTTPException(400, "invalid tenant_id format")
    mxid = mxid_for_tenant(tenant_id)
    try:
        return await mautrix_whoami(mxid)
    except Exception as e:
        raise HTTPException(500, f"mautrix whoami failed: {e}")


@router.get("/mautrix/logins")
async def admin_test_mautrix_logins(
    tenant_id: str = Query(..., description="target tenant_id"),
    dev: int = Query(0),
):
    """List active FB logins for tenant MXID via mautrix (dev only)."""
    _dev_guard(dev)
    if not any(tenant_id.startswith(p) for p in _VALID_PREFIXES):
        raise HTTPException(400, "invalid tenant_id format")
    mxid = mxid_for_tenant(tenant_id)
    try:
        login_ids = await list_logins(mxid)
        return {"mxid": mxid, "login_ids": login_ids}
    except Exception as e:
        raise HTTPException(500, f"mautrix list_logins failed: {e}")


@router.post("/mautrix/start_login")
async def admin_test_mautrix_start_login(
    tenant_id: str = Query(..., description="target tenant_id"),
    dev: int = Query(0),
):
    """Start FB cookie login flow for tenant MXID (dev only).

    Returns login_id + cookie fields needed to complete login.
    Use POST /mautrix/submit_cookies next.
    """
    _dev_guard(dev)
    if not any(tenant_id.startswith(p) for p in _VALID_PREFIXES):
        raise HTTPException(400, "invalid tenant_id format")
    mxid = mxid_for_tenant(tenant_id)
    try:
        step = await start_login(mxid)
        return {"mxid": mxid, "step": step}
    except Exception as e:
        raise HTTPException(500, f"start_login failed: {e}")


@router.post("/mautrix/submit_cookies")
async def admin_test_mautrix_submit_cookies(
    tenant_id: str = Query(..., description="target tenant_id"),
    login_id: str = Query(..., description="login process ID from start_login"),
    step_id: str = Query("fi.mau.meta.cookies", description="step_id from start_login response"),
    dev: int = Query(0),
    xs: str = Query(..., description="xs cookie from messenger.com"),
    c_user: str = Query(..., description="c_user cookie from messenger.com"),
    datr: str = Query(..., description="datr cookie from messenger.com"),
):
    """Submit FB messenger cookies to complete login (dev only).

    Provide xs, c_user, datr from an active messenger.com session.
    """
    _dev_guard(dev)
    if not any(tenant_id.startswith(p) for p in _VALID_PREFIXES):
        raise HTTPException(400, "invalid tenant_id format")
    mxid = mxid_for_tenant(tenant_id)
    cookies = {"xs": xs, "c_user": c_user, "datr": datr}
    try:
        result = await submit_cookies(mxid, login_id, step_id, cookies)
        return {"mxid": mxid, "result": result}
    except Exception as e:
        raise HTTPException(500, f"submit_cookies failed: {e}")


@router.delete("/mautrix/logout")
async def admin_test_mautrix_logout(
    tenant_id: str = Query(..., description="target tenant_id"),
    fb_login_id: str = Query(..., description="FB user ID (from list_logins)"),
    dev: int = Query(0),
):
    """Logout tenant from Facebook via mautrix (dev only)."""
    _dev_guard(dev)
    if not any(tenant_id.startswith(p) for p in _VALID_PREFIXES):
        raise HTTPException(400, "invalid tenant_id format")
    mxid = mxid_for_tenant(tenant_id)
    try:
        await mautrix_logout(mxid, fb_login_id)
        return {"mxid": mxid, "fb_login_id": fb_login_id, "status": "logged_out"}
    except Exception as e:
        raise HTTPException(500, f"logout failed: {e}")
