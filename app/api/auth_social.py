from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Request
from starlette.responses import RedirectResponse
import os
from jose import jwt
from datetime import datetime, timedelta
from sqlalchemy import text
from app.core.db import engine as _db_engine
from app.services import auth as auth_service

router = APIRouter()

oauth = OAuth()

oauth.register(
    name="google",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

oauth.register(
    name="line",
    client_id=os.getenv("LINE_CLIENT_ID"),
    client_secret=os.getenv("LINE_CLIENT_SECRET"),
    authorize_url="https://access.line.me/oauth2/v2.1/authorize",
    access_token_url="https://api.line.me/oauth2/v2.1/token",
    client_kwargs={"scope": "profile openid email"},
)


@router.get("/auth/google")
async def login_google(request: Request):
    redirect_uri = "https://auth.viiv.me/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/auth/google/callback")
async def auth_google_callback(request: Request):
    token = await oauth.google.authorize_access_token(request)
    user = token.get("userinfo") or {}
    email = (user.get("email") or "").strip().lower()
    google_id = user.get("sub") or user.get("id")
    full_name = user.get("name") or ""
    avatar_url = user.get("picture") or ""

    if request.query_params.get("debug") == "1":
        return {"provider": "google", "email": email, "google_id": google_id,
                "token": token, "userinfo": user}

    if not email or not google_id:
        return {"provider": "google", "error": "missing email or google_id"}

    # 1) ค้นด้วย google_id ก่อน → 2) ถ้าไม่เจอ ค้นด้วย email + link → 3) ถ้าไม่เจอเลย สร้างใหม่
    with _db_engine.begin() as c:
        row = c.execute(text(
            "SELECT id, email, full_name, avatar_url FROM viiv_accounts WHERE google_id=:gid LIMIT 1"
        ), {"gid": google_id}).fetchone()

        if row:
            account_id = str(row.id)
        else:
            row = c.execute(text(
                "SELECT id FROM viiv_accounts WHERE email=:em LIMIT 1"
            ), {"em": email}).fetchone()
            if row:
                # มีบัญชีเดิม → link google_id เข้า (เก็บ hashed_password / auth_provider เดิมไว้)
                account_id = str(row.id)
                c.execute(text("""
                    UPDATE viiv_accounts
                       SET google_id  = :gid,
                           avatar_url = COALESCE(NULLIF(avatar_url,''), :av),
                           full_name  = COALESCE(NULLIF(full_name,''),  :fn)
                     WHERE id = :id
                """), {"gid": google_id, "av": avatar_url, "fn": full_name, "id": account_id})
            else:
                # ใหม่ — ไม่มี password (auth_provider='google')
                ins = c.execute(text("""
                    INSERT INTO viiv_accounts
                        (email, full_name, hashed_password, google_id, avatar_url, auth_provider, is_active)
                    VALUES (:em, :fn, NULL, :gid, :av, 'google', true)
                    RETURNING id
                """), {"em": email, "fn": full_name, "gid": google_id, "av": avatar_url}).fetchone()
                account_id = str(ins.id)

        # ตรวจว่ามีร้านแล้วหรือยัง
        shop = c.execute(text(
            "SELECT id FROM tenants WHERE owner_id=:oid LIMIT 1"
        ), {"oid": account_id}).fetchone()
        has_shop = shop is not None

    if has_shop:
        # มีร้านแล้ว → ออก sso_token ให้ /login.html เปิด shop picker
        sso_payload = {
            "sub":     account_id,
            "user_id": account_id,
            "email":   email,
            "role":    "owner",
            "exp":     datetime.utcnow() + timedelta(days=30),
        }
        sso_token = jwt.encode(sso_payload, auth_service.SECRET_KEY, algorithm=auth_service.ALGORITHM)
        return RedirectResponse(url=f"https://viiv.me/login.html?sso_token={sso_token}")

    # ยังไม่มีร้าน → google_session 10 นาที สำหรับ register.html (สร้างร้านต่อ)
    session_payload = {
        "google_id":  google_id,
        "email":      email,
        "full_name":  full_name,
        "avatar_url": avatar_url,
        "exp":        datetime.utcnow() + timedelta(minutes=10),
    }
    google_session = jwt.encode(session_payload, auth_service.SECRET_KEY, algorithm=auth_service.ALGORITHM)
    return RedirectResponse(url=f"https://viiv.me/register.html?google_session={google_session}")


@router.get("/auth/line")
async def login_line(request: Request):
    redirect_uri = request.url_for("auth_line_callback")
    return await oauth.line.authorize_redirect(request, redirect_uri)


@router.get("/auth/line/callback")
async def auth_line_callback(request: Request):
    token = await oauth.line.authorize_access_token(request)
    user_info = token
    return {"provider": "line", "data": user_info}
