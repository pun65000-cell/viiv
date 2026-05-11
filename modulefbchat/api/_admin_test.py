"""
modulefbchat/api/_admin_test.py — Dev-only Matrix admin verify endpoints.
"""
from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException, Query

from ..matrix_admin import register_matrix_user, verify_access_token

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
