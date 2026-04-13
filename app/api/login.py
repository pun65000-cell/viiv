from fastapi import APIRouter, Body, Depends, HTTPException, status
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
