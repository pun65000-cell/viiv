from sqlalchemy.orm import Session
from sqlalchemy import select, text
from app.models.user import User

def get_by_email(db: Session, email: str):
    return db.execute(select(User).where(User.email == email)).scalar_one_or_none()

def get_auth_by_email(db: Session, email: str):
    row = None
    try:
        row = db.execute(
            text("select id, email, hashed_password from users where email = :email limit 1"),
            {"email": email},
        ).mappings().first()
    except Exception:
        row = None

    if row is None:
        try:
            row = db.execute(
                text("select id, email, password_hash from users where email = :email limit 1"),
                {"email": email},
            ).mappings().first()
        except Exception:
            row = None

    if not row:
        return None

    user_id = row.get("id")
    user_email = row.get("email")
    hashed_password = row.get("hashed_password") or row.get("password_hash")
    return {"id": user_id, "email": user_email, "hashed_password": hashed_password}

def create(db: Session, email: str, password_hash: str) -> User:
    u = User(email=email, password_hash=password_hash)
    db.add(u)
    db.flush()
    return u
