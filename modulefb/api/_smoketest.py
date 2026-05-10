"""Phase 3.D.1 smoke test — DEV ONLY
Verifies BrowserPool.get_context() works on this VPS.
TODO: Remove or guard with feature flag after Phase 3.D verification.
"""
from __future__ import annotations
import os
import time
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request

from ..auth import verify_tenant_token

router = APIRouter(tags=["fb-smoketest"])

PROFILE_BASE = Path("/home/viivadmin/viiv/uploads/fb_profiles")


def _dev_guard(request: Request) -> None:
    """Block in production. Dev mode = env VIIV_DEV_MODE=1 OR X-Dev-Mode: 1 header."""
    if os.getenv("VIIV_DEV_MODE") == "1":
        return
    if request.headers.get("X-Dev-Mode") == "1":
        return
    raise HTTPException(403, "smoke test disabled (dev only)")


@router.get("/_smoketest")
async def smoketest(
    request: Request,
    authorization: str = Header(""),
):
    _dev_guard(request)

    claims = verify_tenant_token(authorization)
    tenant_id = claims["tenant_id"]

    pool = request.app.state.pool
    if pool is None or not pool._started:
        raise HTTPException(503, "browser pool not started")

    t0 = time.perf_counter()
    profile_dir = PROFILE_BASE / tenant_id
    files_before: list[str] = (
        sorted(p.name for p in profile_dir.iterdir())
        if profile_dir.exists() else []
    )

    try:
        context = await pool.get_context(tenant_id)
        page = await context.new_page()
        await page.goto("about:blank", timeout=10_000)
        title = await page.title()
        await page.close()
    except Exception as e:
        raise HTTPException(500, f"chromium launch failed: {e}")

    duration_ms = int((time.perf_counter() - t0) * 1000)
    files_after: list[str] = (
        sorted(p.name for p in profile_dir.iterdir())
        if profile_dir.exists() else []
    )

    return {
        "success": True,
        "tenant_id": tenant_id,
        "profile_dir": str(profile_dir),
        "files_before": files_before,
        "files_after": files_after,
        "page_title": title,
        "duration_ms": duration_ms,
        "active_contexts": pool.stats()["active_contexts"],
    }
