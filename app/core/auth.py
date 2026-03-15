from fastapi import Header, HTTPException, status
from typing import Optional
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.repositories import users as user_repo
import os

ALGORITHM = 'HS256'
SECRET_KEY = os.getenv('JWT_SECRET') or os.getenv('SECRET_KEY') or 'dev-secret'


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_current_user(authorization: Optional[str] = Header(default=None)):
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    token = parts[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get('sub')
        if not sub:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    # DB lookup
    with SessionLocal() as db:
        u = user_repo.get_by_email(db, sub) if '@' in sub else None
        if not u:
            # sub is user id
            from uuid import UUID
            try:
                uid = UUID(sub)
            except Exception:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
            u = db.get(__import__('app.models.user', fromlist=['User']).User, uid)
        if not u:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
        return u
