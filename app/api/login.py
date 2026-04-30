from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.schemas.auth import LoginRequest, TokenResponse
from app.services import auth as auth_service

router = APIRouter(prefix="/api", tags=["auth"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    res = auth_service.login(db, payload.email, payload.password)
    if not res:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    token, exp, _u = res
    return TokenResponse(access_token=token, expires_at=exp)


# ── จาก routers_auth.py ────────────────────────────────────────────────────
from app.schemas.auth import RegisterRequest
from app.schemas.users import UserRead
from app.services import package_service as pkg_service

@router.post("/register", response_model=UserRead)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    u = auth_service.register(db, payload.email, payload.password)
    if not u:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email taken")
    db.commit()
    return UserRead(id=str(u.id), email=u.email, created_at=u.created_at)

@router.post("/set-plan")
def set_plan(payload: dict):
    user_id = payload.get("user_id")
    plan = payload.get("plan") or payload.get("pkg")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY)
    if plan and plan in pkg_service.PACKAGES:
        info = pkg_service.set_plan(user_id, plan)
    else:
        info = pkg_service.assign_trial(user_id)
    return {"success": True, "data": info}


# ── Staff Login ────────────────────────────────────────────────────────────────
import jwt as _jwt
import datetime
import os
import time
from sqlalchemy import text
from app.core.db import engine as _db_engine
from passlib.context import CryptContext

_JWT_SECRET = os.getenv("JWT_SECRET", "21cc8b2ff8e25e6262effb2b47b15c39fb16438525b6d041bb842a130c08be7c")
_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
_login_attempts: dict = {}  # key="{ip}:{email}" value={"count":int,"reset_at":float}


@router.post("/staff/login")
def staff_login(payload: dict, request: Request):
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    tenant_id = (payload.get("tenant_id") or "").strip()

    if not email or not password or not tenant_id:
        raise HTTPException(status_code=400, detail="กรุณากรอกข้อมูลให้ครบถ้วน")

    # Rate limit — 5 attempts/minute per ip:email
    ip = request.client.host if request.client else "unknown"
    key = f"{ip}:{email}"
    now = time.time()
    att = _login_attempts.get(key)
    if att and now >= att["reset_at"]:
        att = None
    if att is None:
        att = {"count": 0, "reset_at": now + 60}
        _login_attempts[key] = att
    att["count"] += 1
    if att["count"] > 5:
        raise HTTPException(status_code=429, detail="ลองใหม่อีกครั้งใน 1 นาที")

    # Query tenant_staff (raw SQL, no ORM model)
    with _db_engine.connect() as c:
        row = c.execute(
            text("""SELECT id, first_name, last_name, role, hashed_password
                    FROM tenant_staff
                    WHERE email=:email AND tenant_id=:tid AND is_active=true"""),
            {"email": email, "tid": tenant_id},
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="ไม่พบบัญชีนี้ในระบบ")

    if not row.hashed_password or not _pwd_ctx.verify(password, str(row.hashed_password)):
        raise HTTPException(status_code=401, detail="รหัสผ่านไม่ถูกต้อง")

    # Clear rate limit on success
    _login_attempts.pop(key, None)

    name = f"{row.first_name or ''} {row.last_name or ''}".strip()
    token_payload = {
        "sub": str(row.id),
        "tenant_id": tenant_id,
        "role": row.role,
        "name": name,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=30),
    }
    token = _jwt.encode(token_payload, _JWT_SECRET, algorithm="HS256")

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": row.role,
        "name": name,
        "tenant_id": tenant_id,
    }


# ── Platform Owner Login ──────────────────────────────────────────────────────

@router.get("/platform/me")
def platform_me(authorization: str = Header(default=None)):
    """Validate JWT token + return user identity. Used by login.html (token check)
    and dashboard (display user info)."""
    if not authorization:
        raise HTTPException(status_code=401, detail="missing token")
    try:
        tok = authorization.replace("Bearer ", "").strip()
        payload = _jwt.decode(tok, _JWT_SECRET, algorithms=["HS256"])
    except _jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="invalid token")
    return {
        "user_id":   payload.get("user_id") or payload.get("sub"),
        "email":     payload.get("email"),
        "role":      payload.get("role"),
        "tenant_id": payload.get("tenant_id"),
        "name":      payload.get("name"),
    }


@router.post("/platform/login")
def platform_login(payload: dict, request: Request):
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    if not email or not password:
        raise HTTPException(status_code=400, detail="กรุณากรอก email และ password")

    ip = request.client.host if request.client else "unknown"
    key = f"{ip}:{email}"
    now = time.time()
    att = _login_attempts.get(key)
    if att and now >= att["reset_at"]:
        att = None
    if att is None:
        att = {"count": 0, "reset_at": now + 60}
        _login_attempts[key] = att
    att["count"] += 1
    if att["count"] > 5:
        raise HTTPException(status_code=429, detail="ลองใหม่อีกครั้งใน 1 นาที")

    with _db_engine.connect() as c:
        user = c.execute(
            text("SELECT id, email, full_name, hashed_password, is_active FROM platform_users WHERE email=:e"),
            {"e": email},
        ).fetchone()

    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบบัญชีนี้ในระบบ")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="บัญชีถูกระงับ")
    if not user.hashed_password or not _pwd_ctx.verify(password, str(user.hashed_password)):
        raise HTTPException(status_code=401, detail="รหัสผ่านไม่ถูกต้อง")

    _login_attempts.pop(key, None)

    with _db_engine.connect() as c:
        shops = c.execute(
            text("SELECT id, store_name, subdomain, status FROM tenants WHERE owner_id=:uid ORDER BY created_at"),
            {"uid": str(user.id)},
        ).fetchall()

    first_tid = shops[0].id if shops else None

    token_payload = {
        "user_id": str(user.id),
        "email": user.email,
        "role":  "owner",
        "tenant_id": first_tid,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=30),
    }
    token = _jwt.encode(token_payload, _JWT_SECRET, algorithm="HS256")

    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id":    str(user.id),
        "email":      user.email,
        "role":       "owner",
        "tenant_id":  first_tid,
        "shops": [
            {"id": s.id, "store_name": s.store_name, "subdomain": s.subdomain, "status": s.status}
            for s in shops
        ],
    }
