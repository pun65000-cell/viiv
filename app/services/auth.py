import os
from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.repositories import users as user_repo
from app.models.membership import Membership

ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv('ACCESS_TOKEN_EXPIRE_MINUTES', '60'))
SECRET_KEY = os.getenv('JWT_SECRET') or os.getenv('SECRET_KEY') or 'dev-secret'
ADMIN_EMAIL = os.getenv('ADMIN_EMAIL') or 'admin@viiv.me'

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)

def create_access_token(
    subject: str,
    expires_delta: timedelta | None = None,
    claims: dict | None = None,
) -> tuple[str, datetime]:
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode = {"sub": subject}
    if claims:
        to_encode.update(claims)
    to_encode['exp'] = expire
    token = jwt.encode(to_encode, SECRET_KEY, algorithm="HS256")
    return token, expire


def _get_user_role(db: Session, user) -> str:
    if getattr(user, 'email', None) == ADMIN_EMAIL:
        return 'admin'
    roles = db.execute(select(Membership.role).where(Membership.user_id == user.id)).scalars().all()
    if not roles:
        return 'user'
    priority = {'owner': 3, 'admin': 2, 'member': 1}
    best = None
    best_score = -1
    for r in roles:
        score = priority.get(r, 0)
        if score > best_score:
            best_score = score
            best = r
    return best or 'user'

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
    role = _get_user_role(db, u)
    token, exp = create_access_token(str(u.id), claims={'role': role})
    return token, exp, u
