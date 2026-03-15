import os
from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from app.repositories import users as user_repo

ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv('ACCESS_TOKEN_EXPIRE_MINUTES', '60'))
SECRET_KEY = os.getenv('JWT_SECRET') or os.getenv('SECRET_KEY') or 'dev-secret'

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)

def create_access_token(subject: str, expires_delta: timedelta | None = None) -> tuple[str, datetime]:
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode = {'sub': subject, 'exp': expire}
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return token, expire

def register(db: Session, email: str, password: str):
    if user_repo.get_by_email(db, email):
        return None
    ph = hash_password(password)
    u = user_repo.create(db, email=email, password_hash=ph)
    return u

def login(db: Session, email: str, password: str):
    u = user_repo.get_by_email(db, email)
    if not u or not verify_password(password, u.password_hash):
        return None
    token, exp = create_access_token(str(u.id))
    return token, exp, u
