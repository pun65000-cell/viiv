from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy import text
import httpx, json
from .db import AsyncSessionLocal

router = APIRouter()

@router.get("/conversations")
async def list_conversations(
    tenant_id: Optional[str] = Query(None),
    filter: str = Query("all")
):
    async with AsyncSessionLocal() as db:
        where = "WHERE 1=1"
        params = {}
        if tenant_id:
            where += " AND c.tenant_id = :tid"
            params["tid"] = tenant_id
        else:
            where += " AND c.tenant_id IS NULL"
        if filter == "unread":
            where += " AND c.unread_count > 0"
        if filter == "open":
            where += " AND c.status = 'open'"
        if filter == "line":
            where += " AND c.platform = 'line'"
        rows = await db.execute(text(f"""
            SELECT c.id, c.platform, c.platform_uid, c.display_name,
                   c.picture_url, c.status, c.unread_count,
                   c.bot_enabled, c.updated_at,
                   (SELECT content FROM chat_messages m
                    WHERE m.conversation_id = c.id
                    ORDER BY m.created_at DESC LIMIT 1) AS last_message
            FROM chat_conversations c
            {where}
            ORDER BY c.updated_at DESC LIMIT 100
        """), params)
        convs = []
        for r in rows.mappings():
            convs.append({
                "id": r["id"],
                "platform": r["platform"],
                "platform_uid": r["platform_uid"],
                "display_name": r["display_name"],
                "picture_url": r["picture_url"],
                "status": r["status"],
                "unread_count": r["unread_count"] or 0,
                "bot_enabled": r["bot_enabled"] if r["bot_enabled"] is not None else True,
                "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
                "last_message": r["last_message"],
            })
        return {"conversations": convs}

@router.get("/conversations/{conv_id}/messages")
async def get_messages(conv_id: str):
    async with AsyncSessionLocal() as db:
        rows = await db.execute(text("""
            SELECT id, direction, message_type, content, raw_event, created_at
            FROM chat_messages
            WHERE conversation_id = :cid
            ORDER BY created_at ASC LIMIT 200
        """), {"cid": conv_id})
        msgs = []
        for r in rows.mappings():
            raw = r["raw_event"] or {}
            msgs.append({
                "id": r["id"],
                "direction": r["direction"],
                "message_type": r["message_type"],
                "content": r["content"],
                "sent_by": raw.get("sent_by", "bot" if r["direction"] == "outbound" else "user"),
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            })
        await db.execute(text("UPDATE chat_conversations SET unread_count=0 WHERE id=:cid"), {"cid": conv_id})
        await db.commit()
        return {"messages": msgs}

class ReplyBody(BaseModel):
    text: str

@router.post("/conversations/{conv_id}/reply")
async def reply_message(conv_id: str, body: ReplyBody):
    async with AsyncSessionLocal() as db:
        conv = (await db.execute(text(
            "SELECT platform, platform_uid FROM chat_conversations WHERE id=:cid"
        ), {"cid": conv_id})).fetchone()
        if not conv:
            raise HTTPException(404, "conversation not found")
        cred = (await db.execute(text(
            "SELECT channel_token FROM platform_connections WHERE platform='line' LIMIT 1"
        ))).fetchone()
        if not cred:
            raise HTTPException(500, "LINE credentials not configured")
        async with httpx.AsyncClient() as client:
            r = await client.post(
                "https://api.line.me/v2/bot/message/push",
                headers={"Authorization": f"Bearer {cred[0]}", "Content-Type": "application/json"},
                json={"to": conv[1], "messages": [{"type": "text", "text": body.text}]}
            )
            if r.status_code != 200:
                raise HTTPException(502, f"LINE push failed: {r.text}")
        await db.execute(text("""
            INSERT INTO chat_messages (conversation_id, direction, content, raw_event)
            VALUES (:cid, 'outbound', :text, :raw)
        """), {"cid": conv_id, "text": body.text, "raw": json.dumps({"sent_by": "staff", "via": "dashboard"})})
        await db.execute(text("UPDATE chat_conversations SET updated_at=now() WHERE id=:cid"), {"cid": conv_id})
        await db.commit()
        return {"ok": True}

class BotToggle(BaseModel):
    bot_enabled: bool

@router.patch("/conversations/{conv_id}/bot")
async def toggle_bot(conv_id: str, body: BotToggle):
    async with AsyncSessionLocal() as db:
        await db.execute(text("ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS bot_enabled boolean DEFAULT true"))
        await db.execute(text("UPDATE chat_conversations SET bot_enabled=:val WHERE id=:cid"), {"val": body.bot_enabled, "cid": conv_id})
        await db.commit()
        return {"ok": True, "bot_enabled": body.bot_enabled}

@router.get("/bot/settings")
async def get_bot_settings(tenant_id: Optional[str] = Query(None)):
    async with AsyncSessionLocal() as db:
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS chat_bot_settings (
                tenant_id text PRIMARY KEY,
                welcome_message text DEFAULT '',
                quick_replies jsonb DEFAULT '[]',
                persona text DEFAULT 'friendly-female',
                updated_at timestamptz DEFAULT now()
            )
        """))
        await db.commit()
        tid = tenant_id or "__platform__"
        r = (await db.execute(text("SELECT welcome_message, quick_replies, persona FROM chat_bot_settings WHERE tenant_id=:tid"), {"tid": tid})).fetchone()
        if not r:
            return {"welcome_message": "", "quick_replies": [], "persona": "friendly-female"}
        return {"welcome_message": r[0] or "", "quick_replies": r[1] or [], "persona": r[2] or "friendly-female"}

class BotSettings(BaseModel):
    tenant_id: Optional[str] = None
    welcome_message: Optional[str] = None
    quick_replies: Optional[List[str]] = None
    persona: Optional[str] = None

@router.post("/bot/settings")
async def save_bot_settings(body: BotSettings):
    async with AsyncSessionLocal() as db:
        tid = body.tenant_id or "__platform__"
        await db.execute(text("""
            INSERT INTO chat_bot_settings (tenant_id, welcome_message, quick_replies, persona)
            VALUES (:tid, :wm, :qr, :persona)
            ON CONFLICT (tenant_id) DO UPDATE SET
                welcome_message = COALESCE(EXCLUDED.welcome_message, chat_bot_settings.welcome_message),
                quick_replies   = COALESCE(EXCLUDED.quick_replies, chat_bot_settings.quick_replies),
                persona         = COALESCE(EXCLUDED.persona, chat_bot_settings.persona),
                updated_at      = now()
        """), {"tid": tid, "wm": body.welcome_message, "qr": json.dumps(body.quick_replies) if body.quick_replies is not None else None, "persona": body.persona})
        await db.commit()
        return {"ok": True}

@router.get("/stats")
async def get_stats(tenant_id: Optional[str] = Query(None)):
    async with AsyncSessionLocal() as db:
        tid_filter = "AND c.tenant_id = :tid" if tenant_id else "AND c.tenant_id IS NULL"
        params = {"tid": tenant_id} if tenant_id else {}
        r = (await db.execute(text(f"""
            SELECT
                COUNT(CASE WHEN m.created_at >= now() - interval '1 day' THEN 1 END) AS today,
                COUNT(CASE WHEN m.created_at >= date_trunc('month', now()) THEN 1 END) AS month,
                COUNT(CASE WHEN m.direction='outbound' AND (m.raw_event->>'sent_by')='bot' THEN 1 END) AS bot_replies
            FROM chat_messages m
            JOIN chat_conversations c ON c.id = m.conversation_id
            WHERE 1=1 {tid_filter}
        """), params)).fetchone()
        return {"today": r[0] or 0, "month": r[1] or 0, "bot_replies": r[2] or 0, "conversion": 0}


# ─── Bot Rules CRUD + Status ──────────────────────────────────────────
async def _ensure_rules_table(db):
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS chat_bot_rules (
            id          bigserial PRIMARY KEY,
            tenant_id   text,
            keywords    text[] NOT NULL,
            response    text NOT NULL,
            is_flagged  boolean DEFAULT false,
            is_active   boolean DEFAULT true,
            hit_count   int DEFAULT 0,
            created_at  timestamptz DEFAULT now(),
            updated_at  timestamptz DEFAULT now()
        )
    """))
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS chat_bot_status (
            key   text PRIMARY KEY,
            value text
        )
    """))
    await db.commit()


@router.get("/bot/rules")
async def list_bot_rules(
    tenant_id: Optional[str] = Query(None),
    flagged: Optional[bool] = Query(None),
):
    async with AsyncSessionLocal() as db:
        await _ensure_rules_table(db)
        where = "WHERE 1=1"
        params = {}
        if tenant_id:
            where += " AND tenant_id = :tid"
            params["tid"] = tenant_id
        else:
            where += " AND tenant_id IS NULL"
        if flagged is not None:
            where += " AND is_flagged = :flag"
            params["flag"] = flagged
        rows = (await db.execute(text(f"""
            SELECT id, tenant_id, keywords, response, is_flagged, is_active,
                   hit_count, created_at, updated_at
            FROM chat_bot_rules
            {where}
            ORDER BY is_flagged DESC, updated_at DESC
            LIMIT 500
        """), params)).mappings().all()
        return {"rules": [{
            "id": r["id"],
            "tenant_id": r["tenant_id"],
            "keywords": list(r["keywords"] or []),
            "response": r["response"],
            "is_flagged": bool(r["is_flagged"]),
            "is_active": bool(r["is_active"]),
            "hit_count": r["hit_count"] or 0,
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
        } for r in rows]}


class RuleBody(BaseModel):
    tenant_id: Optional[str] = None
    keywords: List[str]
    response: str
    is_flagged: Optional[bool] = False
    is_active: Optional[bool] = True


@router.post("/bot/rules")
async def create_bot_rule(body: RuleBody):
    kws = [k.strip() for k in (body.keywords or []) if k and k.strip()]
    if not kws or not (body.response or "").strip():
        raise HTTPException(400, "keywords and response required")
    async with AsyncSessionLocal() as db:
        await _ensure_rules_table(db)
        result = (await db.execute(text("""
            INSERT INTO chat_bot_rules (tenant_id, keywords, response, is_flagged, is_active)
            VALUES (:tid, :kws, :resp, :flag, :active)
            RETURNING id
        """), {
            "tid": body.tenant_id,
            "kws": kws,
            "resp": body.response,
            "flag": bool(body.is_flagged),
            "active": bool(body.is_active),
        })).fetchone()
        await db.commit()
        return {"ok": True, "id": result[0]}


class RuleUpdate(BaseModel):
    keywords: Optional[List[str]] = None
    response: Optional[str] = None
    is_flagged: Optional[bool] = None
    is_active: Optional[bool] = None


@router.put("/bot/rules/{rule_id}")
async def update_bot_rule(rule_id: int, body: RuleUpdate):
    sets = []
    params = {"rid": rule_id}
    if body.keywords is not None:
        kws = [k.strip() for k in body.keywords if k and k.strip()]
        if not kws:
            raise HTTPException(400, "at least one non-empty keyword required")
        sets.append("keywords = :kws")
        params["kws"] = kws
    if body.response is not None:
        sets.append("response = :resp")
        params["resp"] = body.response
    if body.is_flagged is not None:
        sets.append("is_flagged = :flag")
        params["flag"] = bool(body.is_flagged)
    if body.is_active is not None:
        sets.append("is_active = :active")
        params["active"] = bool(body.is_active)
    if not sets:
        raise HTTPException(400, "no fields to update")
    sets.append("updated_at = now()")
    async with AsyncSessionLocal() as db:
        await _ensure_rules_table(db)
        await db.execute(text(f"UPDATE chat_bot_rules SET {', '.join(sets)} WHERE id = :rid"), params)
        await db.commit()
        return {"ok": True}


@router.delete("/bot/rules/{rule_id}")
async def delete_bot_rule(rule_id: int):
    async with AsyncSessionLocal() as db:
        await _ensure_rules_table(db)
        await db.execute(text("DELETE FROM chat_bot_rules WHERE id = :rid"), {"rid": rule_id})
        await db.commit()
        return {"ok": True}


@router.get("/bot/status")
async def get_bot_status():
    async with AsyncSessionLocal() as db:
        await _ensure_rules_table(db)
        row = (await db.execute(text(
            "SELECT value FROM chat_bot_status WHERE key='enabled'"
        ))).fetchone()
        enabled = not (row and row[0] == "false")

        rule_count = int((await db.execute(text(
            "SELECT COUNT(*) FROM chat_bot_rules"
        ))).fetchone()[0] or 0)

        avg_row = (await db.execute(text("""
            SELECT AVG(EXTRACT(EPOCH FROM (out_t - in_t)) * 1000)
            FROM (
              SELECT m1.created_at AS in_t,
                     (SELECT MIN(m2.created_at) FROM chat_messages m2
                      WHERE m2.conversation_id = m1.conversation_id
                        AND m2.direction = 'outbound'
                        AND m2.created_at > m1.created_at) AS out_t
              FROM chat_messages m1
              WHERE m1.direction = 'inbound'
                AND m1.created_at >= now() - interval '7 days'
              ORDER BY m1.created_at DESC
              LIMIT 200
            ) t
            WHERE out_t IS NOT NULL
        """))).fetchone()
        avg_ms = float(avg_row[0]) if avg_row and avg_row[0] is not None else 0.0

        size_row = (await db.execute(text("""
            SELECT COALESCE(SUM(pg_total_relation_size(c.oid)), 0)
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind = 'r'
              AND n.nspname = 'public'
              AND c.relname LIKE 'chat_%'
        """))).fetchone()
        db_size = int(size_row[0] or 0)

        return {
            "enabled": enabled,
            "avg_ms": round(avg_ms, 1),
            "rule_count": rule_count,
            "db_size_bytes": db_size,
        }


class StatusToggle(BaseModel):
    enabled: bool


@router.patch("/bot/status")
async def patch_bot_status(body: StatusToggle):
    async with AsyncSessionLocal() as db:
        await _ensure_rules_table(db)
        await db.execute(text("""
            INSERT INTO chat_bot_status (key, value) VALUES ('enabled', :v)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        """), {"v": "true" if body.enabled else "false"})
        await db.commit()
        return {"ok": True, "enabled": body.enabled}
