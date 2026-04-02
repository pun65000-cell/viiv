import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.user import User
from app.services.auth import hash_password


def main():
    db = SessionLocal()
    try:
        email = "admin@viiv.me"
        new_password = "123456"

        user = db.query(User).filter(User.email == email).first()

        if user:
            user.password_hash = hash_password(new_password)
            db.commit()
            print("Admin password reset to 123456")
        else:
            user = User(email=email, password_hash=hash_password(new_password))
            db.add(user)
            db.commit()
            print("Admin created with password 123456")
    finally:
        db.close()


if __name__ == "__main__":
    main()
