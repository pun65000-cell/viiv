from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.services import auth as auth_service
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse
from app.schemas.users import UserRead

router = APIRouter(tags=['auth'])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post('/register', response_model=UserRead)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    u = auth_service.register(db, payload.email, payload.password)
    if not u:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT)
    db.commit()
    return UserRead(id=str(u.id), email=u.email, created_at=u.created_at)

@router.post('/login', response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    res = auth_service.login(db, payload.email, payload.password)
    if not res:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    token, exp, u = res
    return TokenResponse(access_token=token, expires_at=exp)
