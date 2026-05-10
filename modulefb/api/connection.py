"""
modulefb/api/connection.py — Facebook connection management endpoints.

4 endpoints:
  POST /api/fb/connection/save    — บันทึก profile/page URL + optional api_token
  POST /api/fb/connection/verify  — trust-based verify (popup-closed signal)
  GET  /api/fb/connection/status  — ดูสถานะ connection ปัจจุบัน
  POST /api/fb/connection/disconnect — ตัดการเชื่อมต่อ

ขึ้นอยู่กับ DDL ใน scripts/ddl_3a5.sql — ต้องรัน ALTER TABLE ก่อนเรียก /save
"""
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel

from modulefb.auth import verify_tenant_token
from modulefb.browser.crypto import encrypt_session

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class SaveRequest(BaseModel):
    profile_url: Optional[str] = None
    page_url: Optional[str] = None
    api_token: Optional[str] = None


class VerifyRequest(BaseModel):
    pass  # trust-based: popup-closed signal, no user input needed


class StatusResponse(BaseModel):
    connected: bool
    verified: bool
    profile_url: Optional[str] = None
    page_url: Optional[str] = None
    has_api_token: bool
    fb_user_name: Optional[str] = None
    fb_user_id: Optional[str] = None
    status: str        # active | pending_verify | needs_reauth | disconnected | none
    last_active_at: Optional[str] = None
    active_mode: Optional[str] = None  # 'api' | 'page' | 'profile' | None


# ── Helpers ──────────────────────────────────────────────────────────────────

def _calc_active_mode(row: dict) -> Optional[str]:
    """Priority: api > page > profile — runtime calc from stored data."""
    if not row:
        return None
    if row.get("api_token_encrypted"):
        return "api"
    if row.get("page_url"):
        return "page"
    if row.get("profile_url"):
        return "profile"
    return None


# ── Endpoints ────────────────────────────────────────────────────────────────

# DEPRECATED (Phase 3.D.4) — paste-URL flow replaced by canvas login (screencast_ws.py).
# Frontend no longer calls this endpoint. Kept for reference.
# @router.post("/save")
async def save_connection(
    req: SaveRequest,
    request: Request,
    authorization: str = Header(""),
):
    """
    บันทึก FB profile/page URL และ optional Graph API token.
    Phase 3.B.2: ถ้ามี api_token → verify via Graph API → auto-set active.
    UPSERT: preserves existing token + status='active' if already active.
    """
    claims = verify_tenant_token(authorization)
    tenant_id = claims["tenant_id"]
    db = request.app.state.db

    api_token_enc: Optional[str] = None
    if req.api_token:
        api_token_enc = encrypt_session(req.api_token)

    # Phase 3.B.2: API auto-verify
    fb_token_info = None
    if req.api_token:
        from modulefb.fb_graph import verify_fb_token
        fb_token_info = await verify_fb_token(req.api_token)
        if not fb_token_info:
            raise HTTPException(
                400,
                "Facebook API Token ไม่ถูกต้องหรือหมดอายุ — กรุณาตรวจสอบและลองใหม่",
            )

    new_status: Optional[str] = "active" if fb_token_info else None
    new_user_id: Optional[str] = fb_token_info["id"] if fb_token_info else None
    new_user_name: Optional[str] = fb_token_info["name"] if fb_token_info else None
    new_account_type: Optional[str] = (
        ("page" if fb_token_info.get("is_page") else "profile") if fb_token_info else None
    )

    await db.execute(
        """
        INSERT INTO fb_sessions
          (tenant_id, profile_url, page_url, api_token_encrypted,
           fb_user_id, fb_user_name, fb_account_type,
           status, last_login_at, updated_at)
        VALUES
          (:tid, :purl, :pgurl, :tok,
           :uid, :uname, :atype,
           COALESCE(CAST(:status AS text), 'pending_verify'),
           CASE WHEN CAST(:status AS text) = 'active' THEN NOW() ELSE NULL END,
           NOW())
        ON CONFLICT (tenant_id) DO UPDATE SET
          profile_url         = EXCLUDED.profile_url,
          page_url            = EXCLUDED.page_url,
          api_token_encrypted = COALESCE(EXCLUDED.api_token_encrypted,
                                          fb_sessions.api_token_encrypted),
          fb_user_id          = COALESCE(EXCLUDED.fb_user_id, fb_sessions.fb_user_id),
          fb_user_name        = COALESCE(EXCLUDED.fb_user_name, fb_sessions.fb_user_name),
          fb_account_type     = COALESCE(EXCLUDED.fb_account_type,
                                          fb_sessions.fb_account_type),
          status = CASE
            WHEN CAST(:status AS text) = 'active' THEN 'active'
            WHEN fb_sessions.status = 'active' THEN 'active'
            ELSE 'pending_verify'
          END,
          last_login_at = CASE
            WHEN CAST(:status AS text) = 'active' THEN NOW()
            ELSE fb_sessions.last_login_at
          END,
          updated_at = NOW()
        """,
        {
            "tid": tenant_id,
            "purl": req.profile_url,
            "pgurl": req.page_url,
            "tok": api_token_enc,
            "uid": new_user_id,
            "uname": new_user_name,
            "atype": new_account_type,
            "status": new_status,
        },
    )

    session_mgr = request.app.state.session_mgr
    await session_mgr.audit_log(
        tenant_id,
        "save_connection",
        {
            "has_profile": bool(req.profile_url),
            "has_page": bool(req.page_url),
            "has_token": bool(req.api_token),
            "api_verified": bool(fb_token_info),
            "fb_user_id": fb_token_info["id"] if fb_token_info else None,
        },
    )

    return {
        "ok": True,
        "verified": bool(fb_token_info),
        "active_mode": "api" if fb_token_info else None,
        "fb_user_name": fb_token_info["name"] if fb_token_info else None,
    }


@router.post("/verify")
async def verify_ownership(
    req: VerifyRequest,
    request: Request,
    authorization: str = Header(""),
):
    """
    Trust-based verify — ลูกค้า login FB แล้วปิด popup → frontend ส่ง {} มา.
    ตรวจว่ามีข้อมูลบันทึกไว้ → mark active.  ไม่มีการ match ID.
    """
    claims = verify_tenant_token(authorization)
    tenant_id = claims["tenant_id"]
    db = request.app.state.db

    row = await db.fetch_one(
        "SELECT profile_url, page_url FROM fb_sessions WHERE tenant_id = :tid",
        {"tid": tenant_id},
    )
    if not row:
        raise HTTPException(400, "ยังไม่ได้บันทึกข้อมูล Facebook")
    if not row.get("profile_url") and not row.get("page_url"):
        raise HTTPException(400, "กรุณากรอกลิงก์ Facebook ก่อนเชื่อมต่อ")

    account_type = "page" if row.get("page_url") else "profile"

    await db.execute(
        """
        UPDATE fb_sessions SET
          fb_account_type = COALESCE(fb_account_type, :atype),
          status          = 'active',
          last_login_at   = NOW(),
          last_active_at  = NOW(),
          updated_at      = NOW()
        WHERE tenant_id = :tid
        """,
        {"tid": tenant_id, "atype": account_type},
    )

    session_mgr = request.app.state.session_mgr
    await session_mgr.audit_log(
        tenant_id,
        "verify_acknowledged",
        {"method": "popup_closed", "account_type": account_type},
    )

    return {"ok": True, "verified": True, "account_type": account_type}


@router.get("/status", response_model=StatusResponse)
async def connection_status(
    request: Request,
    authorization: str = Header(""),
):
    """
    ดูสถานะ connection ปัจจุบัน.
    Returns StatusResponse — frontend ใช้ status field เพื่อแสดง UI.
    """
    claims = verify_tenant_token(authorization)
    tenant_id = claims["tenant_id"]
    db = request.app.state.db

    row = await db.fetch_one(
        """
        SELECT profile_url, page_url, api_token_encrypted,
               fb_user_id, fb_user_name, fb_account_type,
               status, last_active_at
        FROM fb_sessions
        WHERE tenant_id = :tid
        """,
        {"tid": tenant_id},
    )

    if not row:
        return StatusResponse(
            connected=False,
            verified=False,
            has_api_token=False,
            status="none",
        )

    status = row["status"] or "none"
    last_at = row["last_active_at"]

    return StatusResponse(
        connected=status in ("active", "pending_verify"),
        verified=status == "active",
        profile_url=row["profile_url"],
        page_url=row["page_url"],
        has_api_token=bool(row["api_token_encrypted"]),
        fb_user_name=row["fb_user_name"],
        fb_user_id=row["fb_user_id"],
        status=status,
        last_active_at=last_at.isoformat() if last_at else None,
        active_mode=_calc_active_mode(dict(row)),
    )


@router.post("/disconnect")
async def disconnect(
    request: Request,
    authorization: str = Header(""),
):
    """
    ลูกค้าตัดการเชื่อมต่อ FB — clear session, ปิด browser context.
    session_data_encrypted + api_token_encrypted ถูกลบเพื่อความปลอดภัย.
    """
    claims = verify_tenant_token(authorization)
    tenant_id = claims["tenant_id"]

    session_mgr = request.app.state.session_mgr
    await session_mgr.disconnect(tenant_id)

    return {"ok": True}
