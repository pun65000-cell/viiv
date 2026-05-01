"""
LINE Webhook handler สำหรับ platform LINE OA (1 OA ของ VIIV)
ดึง credentials จาก platform_connections WHERE platform='line'
Phase 1: follow event → save conversation → welcome message

NOTE: Architecture
- LINE Console → :8000 (app.api.pos_line.line_platform_webhook) verifies
  the X-Line-Signature, runs activation logic, then fires off a copy of the
  original body to THIS module via http://localhost:8003/chat/webhook/line/platform
- We DO NOT re-verify the signature here. We trust the X-Forwarded-From:
  viiv-internal header to gate external requests (any direct POST from
  outside the box would not have this header).
"""
import json, httpx
from fastapi import APIRouter, Request, HTTPException
from sqlalchemy import text
from .db import AsyncSessionLocal

router = APIRouter()

async def get_line_credentials(db):
    row = await db.execute(
        text("SELECT channel_token, channel_secret, oa_id FROM platform_connections WHERE platform='line' LIMIT 1")
    )
    return row.fetchone()

async def reply_message(reply_token: str, messages: list, channel_token: str):
    async with httpx.AsyncClient() as client:
        await client.post(
            "https://api.line.me/v2/bot/message/reply",
            headers={
                "Authorization": f"Bearer {channel_token}",
                "Content-Type": "application/json"
            },
            json={"replyToken": reply_token, "messages": messages}
        )

async def get_or_create_conversation(db, platform_uid: str, display_name: str, picture_url: str):
    # platform LINE OA ไม่มี tenant_id (เป็น VIIV platform level)
    result = await db.execute(
        text("""
            INSERT INTO chat_conversations (platform, platform_uid, display_name, picture_url, tenant_id)
            VALUES ('line', :uid, :name, :pic, NULL)
            ON CONFLICT (tenant_id, platform, platform_uid) DO UPDATE
              SET display_name = EXCLUDED.display_name,
                  picture_url  = EXCLUDED.picture_url,
                  updated_at   = now()
            RETURNING id
        """),
        {"uid": platform_uid, "name": display_name, "pic": picture_url}
    )
    await db.commit()
    return result.fetchone()[0]

async def save_message(db, conv_id: str, direction: str, content: str, raw_event: dict):
    await db.execute(
        text("""
            INSERT INTO chat_messages (conversation_id, direction, content, raw_event)
            VALUES (:conv_id, :dir, :content, :raw)
        """),
        {"conv_id": conv_id, "dir": direction, "content": content, "raw": json.dumps(raw_event)}
    )
    await db.commit()

@router.post("/webhook/line/platform")
async def line_platform_webhook(request: Request):
    # Internal-only gate — :8000 sets this header; external callers won't.
    if request.headers.get("X-Forwarded-From") != "viiv-internal":
        raise HTTPException(403, "Forbidden — internal endpoint")

    body_bytes = await request.body()
    body_text = body_bytes.decode("utf-8") if body_bytes else "{}"

    try:
        payload = json.loads(body_text)
    except Exception:
        raise HTTPException(400, "Invalid JSON body")

    async with AsyncSessionLocal() as db:
        creds = await get_line_credentials(db)
        if not creds:
            raise HTTPException(500, "LINE credentials not configured")

        channel_token, channel_secret, oa_id = creds

        for event in payload.get("events", []):
            event_type = event.get("type")
            source = event.get("source", {})
            platform_uid = source.get("userId", "")

            if event_type == "follow":
                # Get LINE profile
                display_name, picture_url = "", ""
                try:
                    async with httpx.AsyncClient() as client:
                        r = await client.get(
                            f"https://api.line.me/v2/bot/profile/{platform_uid}",
                            headers={"Authorization": f"Bearer {channel_token}"}
                        )
                        profile = r.json()
                        display_name = profile.get("displayName", "")
                        picture_url = profile.get("pictureUrl", "")
                except Exception:
                    pass

                conv_id = await get_or_create_conversation(db, platform_uid, display_name, picture_url)
                await save_message(db, conv_id, "inbound", "[follow]", event)

                # Welcome message
                welcome = f"สวัสดีครับ คุณ{display_name} 👋\nขอบคุณที่เพิ่มเพื่อนกับเรานะครับ\nมีอะไรให้ช่วยแจ้งได้เลยครับ 😊"
                await reply_message(event.get("replyToken"), [{"type": "text", "text": welcome}], channel_token)
                await save_message(db, conv_id, "outbound", welcome, {})

        return {"status": "ok"}
