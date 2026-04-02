from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Request
from starlette.responses import RedirectResponse
import os
from jose import jwt
from datetime import datetime, timedelta
from app.core.database import SessionLocal
from app.repositories import users as user_repo
from app.services import auth as auth_service
import secrets

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
    email = user.get("email")
    if request.query_params.get("debug") == "1":
        return {"provider": "google", "email": email, "token": token, "userinfo": user}

    if not email:
        return {"provider": "google", "error": "missing email"}

    with SessionLocal() as db:
        u = user_repo.get_by_email(db, email)
        if not u:
            password_hash = auth_service.hash_password(secrets.token_urlsafe(24))
            u = user_repo.create(db, email=email, password_hash=password_hash)
            db.commit()

        payload = {
            "sub": str(u.id),
            "user_id": str(u.id),
            "email": email,
        "name": user.get("name"),
        "picture": user.get("picture"),
            "exp": datetime.utcnow() + timedelta(minutes=60),
        }
        jwt_token = jwt.encode(payload, auth_service.SECRET_KEY, algorithm=auth_service.ALGORITHM)

    return RedirectResponse(url=f"https://viiv.me/register.html?token={jwt_token}")


@router.get("/auth/line")
async def login_line(request: Request):
    redirect_uri = request.url_for("auth_line_callback")
    return await oauth.line.authorize_redirect(request, redirect_uri)


@router.get("/auth/line/callback")
async def auth_line_callback(request: Request):
    token = await oauth.line.authorize_access_token(request)
    user_info = token
    return {"provider": "line", "data": user_info}
