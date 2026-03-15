from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.user import User

def get_by_email(db: Session, email: str):
    return db.execute(select(User).where(User.email == email)).scalar_one_or_none()

def create(db: Session, email: str, password_hash: str) -> User:
    u = User(email=email, password_hash=password_hash)
    db.add(u)
    db.flush()
    return u
