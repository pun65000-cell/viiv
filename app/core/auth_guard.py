from fastapi import Header, HTTPException
from app.core.token_service import decode_token

def get_current_user(authorization: str = Header(None)):
 if not authorization:
 raise HTTPException(status_code=401)

 parts = authorization.split()

 if len(parts) != 2 or parts[0].lower() != "bearer":
     raise HTTPException(status_code=401)

 token = parts[1]

 try:
     payload = decode_token(token)
     return payload
 except:
     raise HTTPException(status_code=401)
