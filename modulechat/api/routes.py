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


@router.get("/conversations")
async def get_conversations(tenant_id: str = "", filter: str = "", authorization: str = Header("")):
    auth = get_tenant_user(authorization)
    tid = tenant_id or auth["tenant_id"]
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT id, tenant_id, platform, platform_uid, display_name,
                   picture_url, status, unread_count, bot_enabled,
                   created_at, updated_at
            FROM chat_conversations
            WHERE tenant_id = :tid
            ORDER BY updated_at DESC
            LIMIT 100
        """), {"tid": tid}).mappings().all()
    return {"conversations": [dict(r) for r in rows], "total": len(rows)}


@router.get("/conversations/{conv_id}/messages")
async def get_messages(conv_id: str, authorization: str = Header("")):
    auth = get_tenant_user(authorization)
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT id, conversation_id, direction, content, created_at
            FROM chat_messages
            WHERE conversation_id = :cid
            ORDER BY created_at ASC
            LIMIT 200
        """), {"cid": conv_id}).mappings().all()
    return {"messages": [dict(r) for r in rows]}


@router.post("/conversations/{conv_id}/reply")
async def send_reply(conv_id: str, body: dict, authorization: str = Header("")):
    auth = get_tenant_user(authorization)
    txt = body.get("text", "").strip()
    if not txt:
        raise HTTPException(400, "text required")
    with engine.begin() as c:
        # get conv info
        conv = c.execute(text("""
            SELECT platform_uid, tenant_id FROM chat_conversations WHERE id = :cid
        """), {"cid": conv_id}).mappings().first()
        if not conv:
            raise HTTPException(404, "conversation not found")
        # save outbound message
        c.execute(text("""
            INSERT INTO chat_messages (conversation_id, direction, content, raw_event)
            VALUES (:cid, 'outbound', :txt, CAST('{"sent_by":"staff"}' AS jsonb))
        """), {"cid": conv_id, "txt": txt})
        c.execute(text("""
            UPDATE chat_conversations SET updated_at = now() WHERE id = :cid
        """), {"cid": conv_id})
    return {"ok": True}


@router.patch("/conversations/{conv_id}/bot")
async def toggle_bot(conv_id: str, body: dict, authorization: str = Header("")):
    auth = get_tenant_user(authorization)
    enabled = bool(body.get("bot_enabled", True))
    with engine.begin() as c:
        c.execute(text("""
            UPDATE chat_conversations SET bot_enabled = :en WHERE id = :cid
        """), {"en": enabled, "cid": conv_id})
    return {"ok": True, "bot_enabled": enabled}
