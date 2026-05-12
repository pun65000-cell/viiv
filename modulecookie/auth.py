"""JWT + HMAC cookie auth for modulecookie."""
import hashlib
import hmac
import os
import time

import jwt

JWT_SECRET: str = os.environ["JWT_SECRET"]
_COOKIE_SECRET: bytes = JWT_SECRET.encode()


def verify_tenant_token(authorization: str) -> dict:
    token = (authorization or "").replace("Bearer ", "").strip()
    payload = jwt.decode(
        token,
        JWT_SECRET,
        algorithms=["HS256"],
        options={"leeway": 864000, "verify_exp": False},
    )
    if not payload.get("tenant_id"):
        raise ValueError("missing tenant_id")
    return payload


def sign_session_cookie(session_id: str, tenant_id: str) -> str:
    """Return signed cookie value: {session_id}:{tenant_id}:{ts}:{sig}"""
    ts = str(int(time.time()))
    body = f"{session_id}:{tenant_id}:{ts}"
    sig = hmac.new(_COOKIE_SECRET, body.encode(), hashlib.sha256).hexdigest()
    return f"{body}:{sig}"


def verify_session_cookie(cookie: str) -> dict:
    """Verify HMAC-signed cookie. Returns {session_id, tenant_id} or raises."""
    try:
        session_id, tenant_id, ts, sig = cookie.split(":", 3)
    except ValueError:
        raise ValueError("malformed cookie")
    body = f"{session_id}:{tenant_id}:{ts}"
    expected = hmac.new(_COOKIE_SECRET, body.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        raise ValueError("invalid cookie signature")
    return {"session_id": session_id, "tenant_id": tenant_id}
