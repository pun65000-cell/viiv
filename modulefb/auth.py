"""
modulefb/auth.py — JWT verification for modulefb endpoints.

Decoupled from app.* intentionally — modulefb runs as a separate process
and must not bootstrap the main app's config/ORM just to decode a token.

Uses the same JWT_SECRET as the main app (shared secret, same DB).
Algorithm: HS256 (matches app/api/* pattern).
"""
import os
from pathlib import Path

import jwt
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv(Path(__file__).parent.parent / ".env")

JWT_SECRET: str = os.environ["JWT_SECRET"]


def verify_tenant_token(authorization: str) -> dict:
    """
    Parse 'Bearer <token>' from Authorization header value.
    Decode JWT (HS256). Return claims dict.

    Required claims returned: tenant_id, sub (stf_xxx or pfu_xxx), role.
    Raises HTTPException(401) on any failure.

    leeway=864000 + verify_exp=False mirrors the permissive pattern used
    across app/api/* (Rule 24 — dev tokens are semi-permanent).
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

        tenant_id = payload.get("tenant_id")
        if not tenant_id:
            raise ValueError("missing tenant_id")

        return payload

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Unauthorized")
