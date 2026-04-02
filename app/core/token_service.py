import jwt
import os
from datetime import datetime, timedelta

SECRET = os.getenv("JWT_SECRET")


def create_token(user_id: str, role: str):
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=12)
    }
    return jwt.encode(payload, SECRET, algorithm="HS256")


def decode_token(token: str):
    return jwt.decode(token, SECRET, algorithms=["HS256"])
