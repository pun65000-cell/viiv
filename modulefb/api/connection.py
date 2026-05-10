"""
modulefb/api/connection.py — Facebook connection management endpoints.

4 endpoints:
  POST /api/fb/connection/save    — บันทึก profile/page URL + optional api_token
  POST /api/fb/connection/verify  — verify ความเป็นเจ้าของบัญชี FB
  GET  /api/fb/connection/status  — ดูสถานะ connection ปัจจุบัน
  POST /api/fb/connection/disconnect — ตัดการเชื่อมต่อ

ขึ้นอยู่กับ DDL ใน scripts/ddl_3a5.sql — ต้องรัน ALTER TABLE ก่อนเรียก /save
"""
import re
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
    fb_user_id: str
    fb_user_name: Optional[str] = None


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


# ── Helpers ──────────────────────────────────────────────────────────────────

def _extract_fb_identifier(url: Optional[str]) -> Optional[str]:
    """
    Extract numeric FB ID or username from a Facebook profile/page URL.

    Handles:
      https://facebook.com/profile.php?id=100012345678901   → '100012345678901'
      https://facebook.com/{username}                       → '{username}' (lower)
      https://m.facebook.com/{username}                     → '{username}' (lower)
    """
    if not url:
        return None
    # Numeric ID via query param
    m = re.search(r"[?&]id=(\d+)", url)
    if m:
        return m.group(1)
    # Username from path after facebook.com/
    m = re.search(r"facebook\.com/([^/?#]+)", url)
    if m:
        slug = m.group(1).lower()
        # Skip 'profile.php' — already handled above via ?id=
        if slug not in ("profile.php", "pages", "groups", "events"):
            return slug
    return None


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/save")
async def save_connection(
    req: SaveRequest,
    request: Request,
    authorization: str = Header(""),
):
    """
    บันทึก FB profile/page URL และ optional Graph API token.
    UPSERT: ถ้ามีแถวอยู่แล้วและ status='active' → คงสถานะไว้
    api_token ถูก encrypt ก่อนบันทึก.
    ต้องการ columns: profile_url, page_url, api_token_encrypted (ddl_3a5.sql)
    """
    claims = verify_tenant_token(authorization)
    tenant_id = claims["tenant_id"]
    db = request.app.state.db

    api_token_enc: Optional[str] = None
    if req.api_token:
        api_token_enc = encrypt_session(req.api_token)

    await db.execute(
        """
        INSERT INTO fb_sessions
          (tenant_id, profile_url, page_url, api_token_encrypted,
           status, updated_at)
        VALUES
          (:tid, :purl, :pgurl, :tok, 'pending_verify', NOW())
        ON CONFLICT (tenant_id) DO UPDATE SET
          profile_url          = EXCLUDED.profile_url,
          page_url             = EXCLUDED.page_url,
          api_token_encrypted  = COALESCE(
                                   EXCLUDED.api_token_encrypted,
                                   fb_sessions.api_token_encrypted),
          status = CASE
            WHEN fb_sessions.status = 'active' THEN 'active'
            ELSE 'pending_verify'
          END,
          updated_at = NOW()
        """,
        {
            "tid": tenant_id,
            "purl": req.profile_url,
            "pgurl": req.page_url,
            "tok": api_token_enc,
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
        },
    )

    return {"ok": True}


@router.post("/verify")
async def verify_ownership(
    req: VerifyRequest,
    request: Request,
    authorization: str = Header(""),
):
    """
    Verify ว่า FB account ที่ login ตรงกับ URL ที่บันทึกไว้.
    ดึง profile_url + page_url → extract identifier → เปรียบกับ fb_user_id.
    ถ้าตรง → อัปเดต status='active' พร้อม fb_user_id, fb_user_name.
    """
    claims = verify_tenant_token(authorization)
    tenant_id = claims["tenant_id"]
    db = request.app.state.db

    row = await db.fetch_one(
        "SELECT profile_url, page_url FROM fb_sessions WHERE tenant_id = :tid",
        {"tid": tenant_id},
    )
    if not row:
        raise HTTPException(400, "ยังไม่ได้บันทึกลิงก์ FB — กรุณา save ก่อน verify")

    profile_id = _extract_fb_identifier(row["profile_url"])
    page_id = _extract_fb_identifier(row["page_url"])
    target_id = req.fb_user_id.strip().lower()

    match = (profile_id == target_id) or (page_id == target_id)

    if not match:
        session_mgr = request.app.state.session_mgr
        await session_mgr.audit_log(
            tenant_id,
            "verify_failed",
            {
                "target_id": target_id,
                "profile_id": profile_id,
                "page_id": page_id,
            },
        )
        raise HTTPException(400, "บัญชีที่ login ไม่ตรงกับลิงก์ที่บันทึกไว้")

    account_type = "page" if (page_id and page_id == target_id) else "profile"

    await db.execute(
        """
        UPDATE fb_sessions SET
          fb_user_id      = :uid,
          fb_user_name    = :uname,
          fb_account_type = :atype,
          status          = 'active',
          last_login_at   = NOW(),
          last_active_at  = NOW(),
          updated_at      = NOW()
        WHERE tenant_id = :tid
        """,
        {
            "tid": tenant_id,
            "uid": req.fb_user_id,
            "uname": req.fb_user_name,
            "atype": account_type,
        },
    )

    session_mgr = request.app.state.session_mgr
    await session_mgr.audit_log(
        tenant_id,
        "verify_success",
        {"fb_user_id": req.fb_user_id, "account_type": account_type},
    )

    return {"ok": True, "account_type": account_type}


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
