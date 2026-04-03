from fastapi import Header, HTTPException
from app.core.token_service import decode_token

def require_owner(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401)

    parts = authorization.split()

    if len(parts) != 2:
        raise HTTPException(status_code=401)

    token = parts[1]

    try:
        payload = decode_token(token)

        if payload.get("role") != "owner":
            raise HTTPException(status_code=403)

        return payload

    except:
        raise HTTPException(status_code=401)
