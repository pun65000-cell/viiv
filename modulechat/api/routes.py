from fastapi import APIRouter, Header, HTTPException
from sqlalchemy import text
from app.core.db import engine
import jwt, os
from datetime import datetime

router = APIRouter(prefix="/api/chat", tags=["chat"])
JWT_SECRET = os.getenv("JWT_SECRET", "")

def get_tenant_user(authorization=""):
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"], options={"leeway":864000,"verify_exp":False})
        uid = payload.get("sub"); tid = payload.get("tenant_id")
        with engine.connect() as c:
            if not tid and uid:
                u = c.execute(text("SELECT email FROM users WHERE id=:uid LIMIT 1"),{"uid":uid}).fetchone()
                if u:
                    t = c.execute(text("SELECT id FROM tenants WHERE email=:e LIMIT 1"),{"e":u[0]}).fetchone()
                    if t: tid = t[0]
        if not tid: raise HTTPException(status_code=401, detail="Unauthorized")
        return {"tenant_id": tid, "user_id": uid}
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=401, detail=str(e))

@router.get("/summary")
async def chat_summary(authorization: str = Header("")):
    auth = get_tenant_user(authorization)
    today = datetime.now().date().isoformat()
    month = today[:7]
    # TODO: query chat tables เมื่อพร้อม
    return {
        "tenant_id": auth["tenant_id"],
        "today": 0,
        "month": 0,
        "closed_month": 0,
        "conversion": 0.0,
        "ai_reply_pct": 0.0,
        "live_feed": []
    }

@router.get("/live-feed")
async def chat_live_feed(limit: int = 10, authorization: str = Header("")):
    auth = get_tenant_user(authorization)
    return {"feed": [], "total": 0}

@router.get("/sessions")
async def chat_sessions(status: str = "active", authorization: str = Header("")):
    auth = get_tenant_user(authorization)
    return {"sessions": [], "total": 0}
