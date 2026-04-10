import os
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.repositories import users as user_repo
from app.services import auth as auth_service
from app.services import package_service as pkg_service

router = APIRouter(tags=["admin-auth"])

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL") or "admin@viiv.me"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _create_admin_token(user_id: str, email: str) -> str:
    exp = datetime.utcnow() + timedelta(minutes=60)
    payload = {"sub": user_id, "user_id": user_id, "email": email, "is_admin": True, "exp": exp}
    return jwt.encode(payload, auth_service.SECRET_KEY, algorithm=auth_service.ALGORITHM)


async def get_current_admin(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    token = parts[1]

    try:
        payload = jwt.decode(token, auth_service.SECRET_KEY, algorithms=[auth_service.ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    from app.repositories import users as user_repo
    u = user_repo.get_by_email(db, ADMIN_EMAIL)
    if not u or str(u.id) != sub:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    if not u:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return u


@router.post("/admin/login")
def admin_login(payload: dict, db: Session = Depends(get_db)):
    email = payload.get("email")
    password = payload.get("password")

    if email != ADMIN_EMAIL:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    if not password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    u = user_repo.get_by_email(db, email)
    if not u:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="admin not found")

    if not auth_service.verify_password(password, u.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    token = _create_admin_token(str(u.id), u.email)
    return {"access_token": token, "token_type": "bearer"}


@router.post("/admin/change-password")
def change_password(payload: dict, user=Depends(get_current_admin), db: Session = Depends(get_db)):
    old_password = payload.get("old_password")
    new_password = payload.get("new_password")

    if not old_password or not new_password:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY)

    if not auth_service.verify_password(old_password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    user.hashed_password = auth_service.hash_password(new_password)
    db.add(user)
    db.commit()
    return {"success": True}


@router.get("/admin/packages")
def admin_list_packages(user=Depends(get_current_admin), db: Session = Depends(get_db)):
    result = {"packages": pkg_service.get_packages(), "users": []}
    data = pkg_service.list_user_packages()
    for uid, info in data.items():
        try:
            u = db.get(__import__("app.models.user", fromlist=["User"]).User, uuid.UUID(uid))
            email = u.email if u else None
        except Exception:
            email = None
        result["users"].append(
            {"user_id": uid, "email": email, "plan": info.get("plan"), "expires_at": info.get("expires_at")}
        )
    return result


@router.post("/admin/assign-trial")
def admin_assign_trial(payload: dict, user=Depends(get_current_admin)):
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY)
    info = pkg_service.assign_trial(user_id)
    return {"success": True, "data": info}
