from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
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
    tenant_id = (payload.get("tenant_id") or "").strip()  # optional

    if not email or not password:
        raise HTTPException(status_code=400, detail="กรุณากรอกอีเมลและรหัสผ่าน")

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

    # Query tenant_staff — by email (+ tenant_id ถ้ามี) JOIN tenants เพื่อดึงชื่อร้าน
    with _db_engine.connect() as c:
        if tenant_id:
            rows = c.execute(
                text("""SELECT s.id, s.user_id, s.first_name, s.last_name, s.role,
                               s.hashed_password, s.tenant_id,
                               t.store_name, t.subdomain
                        FROM tenant_staff s
                        LEFT JOIN tenants t ON t.id = s.tenant_id
                        WHERE s.email=:email AND s.tenant_id=:tid
                              AND s.is_active=true"""),
                {"email": email, "tid": tenant_id},
            ).fetchall()
        else:
            rows = c.execute(
                text("""SELECT s.id, s.user_id, s.first_name, s.last_name, s.role,
                               s.hashed_password, s.tenant_id,
                               t.store_name, t.subdomain
                        FROM tenant_staff s
                        LEFT JOIN tenants t ON t.id = s.tenant_id
                        WHERE s.email=:email AND s.is_active=true"""),
                {"email": email},
            ).fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail="ไม่พบบัญชีนี้ในระบบ")

    # Filter rows where password matches — รองรับกรณีรหัสต่างกันต่อร้าน
    valid = [r for r in rows if r.hashed_password
             and _pwd_ctx.verify(password, str(r.hashed_password))]
    if not valid:
        raise HTTPException(status_code=401, detail="รหัสผ่านไม่ถูกต้อง")

    # หลายร้าน + ไม่ระบุ tenant_id → ส่งรายการให้ frontend เลือก
    if len(valid) > 1 and not tenant_id:
        return {
            "status": "select_shop",
            "shops": [
                {
                    "tenant_id":  r.tenant_id,
                    "store_name": r.store_name or r.tenant_id,
                    "subdomain":  r.subdomain or r.tenant_id,
                    "role":       r.role,
                }
                for r in valid
            ],
        }

    # ร้านเดียว (หรือระบุ tenant_id แล้ว) → ออก token เลย
    row = valid[0]
    resolved_tid = row.tenant_id

    # Clear rate limit on success
    _login_attempts.pop(key, None)

    name = f"{row.first_name or ''} {row.last_name or ''}".strip()
    token_payload = {
        "sub": str(row.id),
        "tenant_id": resolved_tid,
        "role": row.role,
        "name": name,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=30),
    }
    token = _jwt.encode(token_payload, _JWT_SECRET, algorithm="HS256")

    try:
        with _db_engine.begin() as c:
            for shop in valid:
                c.execute(text("""
                    INSERT INTO token_security_log
                        (user_id, tenant_id, ip, user_agent, action)
                    VALUES (:uid, :tid, :ip, :ua, 'login')
                """), {
                    "uid": str(shop.user_id) if hasattr(shop, 'user_id') and shop.user_id else None,
                    "tid": str(shop.tenant_id),
                    "ip": ip,
                    "ua": request.headers.get("User-Agent", "")[:200],
                })
    except Exception:
        pass  # ไม่ให้ log พัง block login

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": row.role,
        "name": name,
        "tenant_id": resolved_tid,
        "subdomain": row.subdomain or resolved_tid,
        "store_name": row.store_name or resolved_tid,
    }


# ── Platform Owner Login ──────────────────────────────────────────────────────

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
            text("SELECT id, email, full_name, hashed_password, is_active FROM viiv_accounts WHERE email=:e"),
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
        "sub":     str(user.id),    # JWT convention — _admin_auth ใช้ field นี้ตรวจสิทธิ์
        "user_id": str(user.id),
        "email":   user.email,
        "role":    "owner",
        "tenant_id": first_tid,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=30),
    }
    token = _jwt.encode(token_payload, _JWT_SECRET, algorithm="HS256")

    try:
        with _db_engine.begin() as c:
            c.execute(text("""
                INSERT INTO token_security_log
                    (user_id, tenant_id, ip, user_agent, action)
                VALUES (:uid, :tid, :ip, :ua, 'platform_login')
            """), {
                "uid": str(user.id),
                "tid": first_tid,
                "ip": ip,
                "ua": request.headers.get("User-Agent", "")[:200],
            })
    except Exception:
        pass

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
