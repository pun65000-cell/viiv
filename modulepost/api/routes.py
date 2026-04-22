from fastapi import APIRouter, Header, HTTPException
from sqlalchemy import text
from app.core.db import engine
import jwt, os
from datetime import datetime

router = APIRouter(prefix="/api/post", tags=["post"])
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
async def post_summary(authorization: str = Header("")):
    auth = get_tenant_user(authorization)
    return {
        "tenant_id": auth["tenant_id"],
        "posts_today": 0,
        "posts_month": 0,
        "views_month": 0,
        "queue": 0,
        "building": 0,
        "hook_latest": "",
        "platforms": {"tiktok":0,"instagram":0,"facebook":0,"line":0}
    }

@router.get("/posts")
async def post_list(limit: int = 20, offset: int = 0, authorization: str = Header("")):
    auth = get_tenant_user(authorization)
    return {"posts": [], "total": 0}

@router.get("/queue")
async def post_queue(authorization: str = Header("")):
    auth = get_tenant_user(authorization)
    return {"queue": [], "total": 0}
