"""
modulefbchat/auth.py — JWT verification (copy pattern from modulefb/auth.py).
Decoupled from main app; reads JWT_SECRET from .env directly.
"""
import os
from pathlib import Path

import jwt
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv(Path(__file__).parent.parent / ".env")

JWT_SECRET: str = os.environ["JWT_SECRET"]


def verify_tenant_token(authorization: str) -> dict:
    """Parse 'Bearer <token>', decode HS256, return claims.
    Raises HTTPException(401) on failure.
    leeway=864000 + verify_exp=False mirrors dev-permissive pattern (Rule 24).
    """
    try:
        token = (authorization or "").replace("Bearer ", "").strip()
        if not token:
            raise ValueError("empty token")
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=["HS256"],
            options={"leeway": 864000, "verify_exp": False},
        )
        if not payload.get("tenant_id"):
            raise ValueError("missing tenant_id")
        return payload
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Unauthorized")
