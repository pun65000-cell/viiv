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

async def save_message(db, conv_id: str, direction: str, content: str, raw_event: dict, msg_type: str = "text"):
    await db.execute(
        text("""
            INSERT INTO chat_messages (conversation_id, direction, message_type, content, raw_event)
            VALUES (:conv_id, :dir, :mtype, :content, :raw)
        """),
        {"conv_id": conv_id, "dir": direction, "mtype": msg_type,
         "content": content, "raw": json.dumps(raw_event)}
    )
    await db.commit()


# ─── Bot Phase 1 — rule-based message handler (no AI) ──────────────────
KEYWORD_RULES = [
    (
        ["สินค้า", "ราคา", "มีอะไรบ้าง", "catalog", "menu", "เมนู"],
        "📦 สินค้าและราคา\n"
        "พิมพ์ชื่อสินค้าที่สนใจมาได้เลยนะคะ\n"
        "หรือรอทีมงานส่ง catalog ให้สักครู่ค่ะ 😊"
    ),
    (
        ["สั่ง", "ซื้อ", "order", "ออเดอร์"],
        "🛒 วิธีสั่งซื้อ:\n"
        "1) แจ้งสินค้า + จำนวน\n"
        "2) แจ้งที่อยู่จัดส่ง\n"
        "3) โอนเงินตามที่แจ้ง แล้วส่งสลิป\n"
        "ทีมงานจะดูแลออเดอร์ให้ค่ะ 📦"
    ),
    (
        ["ที่อยู่", "อยู่ที่ไหน", "location", "address", "พิกัด"],
        "📍 ที่อยู่ร้าน:\n"
        "ทีมงานจะส่งพิกัด/แผนที่ละเอียดให้นะคะ"
    ),
    (
        ["เวลา", "เปิด", "ปิด", "กี่โมง"],
        "🕘 เวลาทำการ:\n"
        "จันทร์-ศุกร์ 09:00-18:00\n"
        "เสาร์ 10:00-16:00\n"
        "อาทิตย์ ปิดค่ะ"
    ),
    (
        ["โทร", "เบอร์", "ติดต่อ", "tel", "phone"],
        "📞 ทีมงานจะแจ้งเบอร์โทรให้นะคะ\n"
        "หรือคุยใน LINE นี้ได้สะดวกเหมือนกันค่ะ 😊"
    ),
    (
        ["ขอบคุณ", "thank", "thx", "thanks"],
        "ยินดีค่ะ 🙏\nหากมีคำถามอื่นทักได้เลยนะคะ 😊"
    ),
]


async def get_bot_settings(db):
    """อ่าน bot settings ของ platform LINE OA (tenant_id='__platform__')."""
    default = {"welcome_message": "", "quick_replies": [], "persona": "friendly-female"}
    try:
        row = (await db.execute(
            text("""
                SELECT welcome_message, quick_replies, persona
                FROM chat_bot_settings
                WHERE tenant_id = '__platform__'
                LIMIT 1
            """)
        )).fetchone()
        if not row:
            return default
        wm, qr, persona = row
        return {
            "welcome_message": wm or "",
            "quick_replies": qr or [],
            "persona": persona or "friendly-female",
        }
    except Exception:
        return default


PERSONA_MAP = {
    "friendly-female": {
        "suffix": "ค่ะ 😊",
        "greeting": "สวัสดีค่ะ",
        "pronoun": "หนู",
        "sign": "ค่ะ",
    },
    "professional-female": {
        "suffix": "ค่ะ",
        "greeting": "สวัสดีค่ะ",
        "pronoun": "ดิฉัน",
        "sign": "ค่ะ",
    },
    "cute-female": {
        "suffix": "นะคะ 🌸",
        "greeting": "สวัสดีค้า~",
        "pronoun": "หนู",
        "sign": "ค้า",
    },
    "friendly-male": {
        "suffix": "ครับ 😊",
        "greeting": "สวัสดีครับ",
        "pronoun": "ผม",
        "sign": "ครับ",
    },
    "professional-male": {
        "suffix": "ครับ",
        "greeting": "สวัสดีครับ",
        "pronoun": "ผม",
        "sign": "ครับ",
    },
    "casual-male": {
        "suffix": "นะครับ 👍",
        "greeting": "หวัดดีครับ",
        "pronoun": "ผม",
        "sign": "ครับ",
    },
}

DEFAULT_PERSONA = PERSONA_MAP["friendly-female"]


def apply_persona(text: str, persona_key: str) -> str:
    """แทน {END} ด้วย suffix ของ persona และปรับ pronoun/sign"""
    p = PERSONA_MAP.get(persona_key, DEFAULT_PERSONA)
    # แทน {END} ด้วย suffix
    result = text.replace("{END}", p["suffix"])
    # ถ้าไม่มี {END} เลย และ text ไม่ได้ลงท้ายด้วย sign อยู่แล้ว → ไม่แตะ
    return result


def bot_reply(text_in: str, bot_settings: dict) -> str | None:
    """Match keyword rules; return reply text หรือ None ถ้าไม่ตรง rule ใดเลย."""
    if not text_in:
        return None
    persona_key = bot_settings.get("persona", "friendly-female")
    t = text_in.lower().strip()
    for keywords, reply in KEYWORD_RULES:
        for kw in keywords:
            if kw.lower() in t:
                return apply_persona(reply, persona_key)
    return None


def fallback_reply(persona_key: str = "friendly-female") -> str:
    p = PERSONA_MAP.get(persona_key, DEFAULT_PERSONA)
    return f"ขอบคุณที่ติดต่อมานะ{p['sign']} 🙏\nทีมงานจะติดต่อกลับเร็วๆ นี้{p['suffix']}"


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
                await save_message(db, conv_id, "inbound", "[follow]",
                                   {"event": event, "message_id": ""}, "follow")

                # Welcome message (apply persona + custom welcome from settings)
                bot_settings = await get_bot_settings(db)
                persona_key = bot_settings.get("persona", "friendly-female")
                p = PERSONA_MAP.get(persona_key, DEFAULT_PERSONA)
                custom_welcome = bot_settings.get("welcome_message", "")
                if custom_welcome:
                    welcome = apply_persona(custom_welcome.replace("{NAME}", display_name), persona_key)
                else:
                    welcome = (
                        f"{p['greeting']} คุณ{display_name} 👋\n"
                        f"ขอบคุณที่เพิ่มเพื่อนกับเรานะ{p['sign']}\n"
                        f"มีอะไรให้ช่วยแจ้งได้เลย{p['suffix']}"
                    )
                await reply_message(event.get("replyToken"), [{"type": "text", "text": welcome}], channel_token)
                await save_message(db, conv_id, "outbound", welcome, {})

            elif event_type == "message":
                msg = event.get("message", {})
                msg_type = msg.get("type", "text")
                msg_id   = msg.get("id", "")

                if msg_type == "text":
                    user_text = msg.get("text", "")
                    content = user_text
                elif msg_type == "image":
                    content = "[รูปภาพ]"
                    user_text = ""
                elif msg_type == "sticker":
                    pkg = msg.get("packageId", "")
                    sid = msg.get("stickerId", "")
                    content = f"[สติ๊กเกอร์ {pkg}/{sid}]"
                    user_text = ""
                elif msg_type == "video":
                    content = "[วิดีโอ]"
                    user_text = ""
                elif msg_type == "audio":
                    content = "[เสียง]"
                    user_text = ""
                elif msg_type == "file":
                    fname = msg.get("fileName", "ไฟล์")
                    content = f"[ไฟล์: {fname}]"
                    user_text = ""
                elif msg_type == "location":
                    title = msg.get("title", "")
                    content = f"[ตำแหน่ง: {title}]" if title else "[ตำแหน่ง]"
                    user_text = ""
                else:
                    content = f"[{msg_type}]"
                    user_text = ""

                # Best-effort profile fetch
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
                await save_message(
                    db, conv_id, "inbound", content,
                    {"event": event, "message_id": msg_id}, msg_type,
                )

                # Bump unread + updated_at on the conversation (every inbound)
                await db.execute(
                    text("""
                        UPDATE chat_conversations
                        SET unread_count = COALESCE(unread_count, 0) + 1,
                            updated_at   = now()
                        WHERE id = :cid
                    """),
                    {"cid": conv_id},
                )
                await db.commit()

                # Bot reply gate: text only — non-text save metadata only, no reply
                if msg_type != "text":
                    continue

                # Bot rule-based reply (no AI)
                bot_settings = await get_bot_settings(db)
                reply_text = bot_reply(user_text, bot_settings)
                is_fallback = reply_text is None
                persona_key = bot_settings.get("persona", "friendly-female")
                if is_fallback:
                    reply_text = fallback_reply(persona_key)

                await reply_message(
                    event.get("replyToken"),
                    [{"type": "text", "text": reply_text}],
                    channel_token,
                )
                await save_message(
                    db, conv_id, "outbound", reply_text,
                    {"sent_by": "bot", "fallback": is_fallback},
                )

        return {"status": "ok"}
