from app.api.pos_line_quote import render_quote_jpg, push_image_to_line
# app/api/pos_line.py
# LINE Integration v1.11

import hmac, hashlib, base64, json, os, random, string, time
import jwt
from fastapi import APIRouter, BackgroundTasks, Request, Header, HTTPException
from sqlalchemy import text
from app.core.db import engine

router = APIRouter()

JWT_SECRET = os.getenv("JWT_SECRET", "")

def _new_id(prefix):
    rand = "".join(random.choices(string.ascii_lowercase + string.digits, k=4))
    return f"{prefix}_{int(time.time())}_{rand}"

def get_tenant_user(authorization=""):
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"],
            options={"leeway":864000,"verify_exp":False})
        uid = payload.get("sub"); tid = payload.get("tenant_id")
        with engine.connect() as c:
            if not tid and uid:
                u = c.execute(text("SELECT email FROM users WHERE id=:uid LIMIT 1"),
                    {"uid":uid}).fetchone()
                if u:
                    t = c.execute(text("SELECT id FROM tenants WHERE email=:e LIMIT 1"),
                        {"e":u[0]}).fetchone()
                    if t: tid = t[0]
            if not tid and payload.get("role")=="admin":
                t = c.execute(text("SELECT id FROM tenants ORDER BY created_at LIMIT 1")).fetchone()
                if t: tid = t[0]
        if tid: return tid, uid or "unknown"
    except: pass
    raise HTTPException(401, "Unauthorized")

def _verify_signature(channel_secret, body, sig_header):
    if not channel_secret or not sig_header:
        return False
    digest = hmac.new(
        channel_secret.encode("utf-8"),
        body,
        hashlib.sha256
    ).digest()
    expected = base64.b64encode(digest).decode("utf-8")
    return hmac.compare_digest(expected, sig_header)

def _get_channel_secret(tenant_id):
    with engine.connect() as c:
        row = c.execute(
            text("SELECT channel_secret FROM line_settings WHERE tenant_id=:tid LIMIT 1"),
            {"tid": tenant_id}
        ).fetchone()
    return row[0] if row and row[0] else ""

def _get_channel_token(tenant_id):
    with engine.connect() as c:
        row = c.execute(
            text("SELECT channel_token FROM line_settings WHERE tenant_id=:tid LIMIT 1"),
            {"tid": tenant_id}
        ).fetchone()
    return row[0] if row and row[0] else ""


PERSONA_MAP = {
    "friendly-female": {"suffix": "ค่ะ", "greeting": "สวัสดีค่ะ", "sign": "ค่ะ"},
    "professional-female": {"suffix": "ค่ะ", "greeting": "สวัสดีค่ะ", "sign": "ค่ะ"},
    "cute-female": {"suffix": "นะคะ", "greeting": "สวัสดีค่ะ", "sign": "ค้า"},
    "friendly-male": {"suffix": "ครับ", "greeting": "สวัสดีครับ", "sign": "ครับ"},
    "professional-male": {"suffix": "ครับ", "greeting": "สวัสดีครับ", "sign": "ครับ"},
    "casual-male": {"suffix": "นะครับ", "greeting": "หวัดดีครับ", "sign": "ครับ"},
}
DEFAULT_PERSONA = PERSONA_MAP["friendly-female"]


def _apply_persona(text: str, persona_key: str) -> str:
    p = PERSONA_MAP.get(persona_key, DEFAULT_PERSONA)
    return text.replace("{END}", p["suffix"])


def _get_tenant_persona(tenant_id: str, conn) -> str:
    try:
        row = conn.execute(text("""
            SELECT persona FROM chat_bot_settings
            WHERE tenant_id = :tid LIMIT 1
        """), {"tid": tenant_id}).fetchone()
        return (row[0] or "friendly-female") if row else "friendly-female"
    except Exception:
        return "friendly-female"


def _tenant_bot_reply(text_in: str, tenant_id: str, conn) -> str:
    txt = text_in.lower().strip()
    persona_key = _get_tenant_persona(tenant_id, conn)
    p = PERSONA_MAP.get(persona_key, DEFAULT_PERSONA)

    # อ่าน rules จาก DB (tenant-specific มาก่อน, ตามด้วย global rules)
    try:
        rules = conn.execute(text("""
            SELECT keywords, response FROM chat_bot_rules
            WHERE (tenant_id = :tid OR tenant_id IS NULL)
              AND is_active = true
            ORDER BY tenant_id NULLS LAST, id
        """), {"tid": tenant_id}).fetchall()
        for rule in rules:
            keywords = rule[0] or []
            for kw in keywords:
                if kw and kw.lower().strip() in txt:
                    return _apply_persona(rule[1], persona_key)
    except Exception:
        pass

    # fallback keyword rules
    sign = p["sign"]
    KEYWORDS = {
        ("สินค้า","ราคา","มีอะไร","catalog","product"):
            f"ดูสินค้าของเราได้เลยนะ{sign}\nมีอะไรให้ช่วยเพิ่มเติมไหม{sign}",
        ("สั่ง","ซื้อ","order"):
            f"แจ้งรายการสินค้าที่ต้องการได้เลย{sign}",
        ("ที่อยู่","อยู่ที่ไหน","location","map"):
            f"ทีมงานจะส่งที่อยู่ให้นะ{sign}",
        ("เวลา","เปิด","ปิด","กี่โมง"):
            f"เปิดให้บริการทุกวัน{sign} มีอะไรให้ช่วยเพิ่มเติมไหม{sign}",
        ("โทร","เบอร์","ติดต่อ","tel","phone"):
            f"ทักแชทได้เลย{sign} หรือรอทีมงานติดต่อกลับนะ{sign}",
        ("ขอบคุณ","thank","ขอบใจ"):
            f"ยินดีให้บริการเสมอ{sign}",
    }
    for kws, reply in KEYWORDS.items():
        if any(kw in txt for kw in reply):
            return reply

    return f"ขอบคุณที่ติดต่อมานะ{sign} ทีมงานจะติดต่อกลับเร็ว ๆ นี้{sign}"


def _ai_reply(message_text: str, tenant_id: str, conv_id: str) -> str | None:
    """
    เรียก moduleai /chat → return reply string
    ถ้า fail → return None (caller ใช้ bot fallback)
    timeout 8 วินาที (LINE replyToken หมดอายุ 30s)
    """
    try:
        import httpx as _httpx
        with _httpx.Client(timeout=8.0) as hc:
            r = hc.post(
                "http://localhost:8002/chat",
                json={
                    "message":   message_text,
                    "slot":      "chat_bot",
                    "tenant_id": tenant_id,
                    "source":    "line_chat",
                    "shop_id":   tenant_id,
                },
            )
            if r.status_code == 200:
                return r.json().get("reply")
            _log.warning("moduleai returned %d for tenant=%s", r.status_code, tenant_id)
            return None
    except Exception as e:
        _log.warning("_ai_reply failed tenant=%s: %s", tenant_id, e)
        return None


def _ai_push_reply(
    message_text: str,
    tenant_id: str,
    line_uid: str,
    channel_token: str,
    conv_id: str,
):
    """
    Background task:
    เรียก moduleai → ได้ reply → push ไปลูกค้าผ่าน LINE push API
    ไม่มี replyToken timeout
    """
    try:
        import httpx as _httpx

        # 1. เรียก AI (timeout 25s — push ไม่มี deadline)
        with _httpx.Client(timeout=25.0) as hc:
            r = hc.post(
                "http://localhost:8002/chat",
                json={
                    "message":   message_text,
                    "slot":      "chat_bot",
                    "tenant_id": tenant_id,
                    "source":    "line_chat",
                    "shop_id":   tenant_id,
                },
            )
            if r.status_code != 200:
                _log.warning("moduleai %d tenant=%s", r.status_code, tenant_id)
                return
            ai_reply = r.json().get("reply", "")

        if not ai_reply:
            return

        # 2. push ไปลูกค้า (ไม่ใช่ reply — ไม่หมดอายุ)
        with _httpx.Client(timeout=10.0) as hc:
            resp = hc.post(
                "https://api.line.me/v2/bot/message/push",
                headers={
                    "Authorization": f"Bearer {channel_token}",
                    "Content-Type": "application/json",
                },
                json={
                    "to": line_uid,
                    "messages": [{"type": "text", "text": ai_reply}],
                },
            )
            if resp.status_code != 200:
                _log.warning("LINE push failed %d: %s", resp.status_code, resp.text[:100])
                return

        # 3. save outbound message
        with engine.begin() as c:
            c.execute(text("""
                INSERT INTO chat_messages
                    (conversation_id, direction, content, raw_event)
                VALUES (:cid, 'outbound', :txt, CAST(:raw AS jsonb))
            """), {
                "cid": conv_id,
                "txt": ai_reply,
                "raw": '{"sent_by":"ai_push"}',
            })

        _log.info("[ai_push] tenant=%s uid=%s reply=%d chars",
                  tenant_id, line_uid[:8], len(ai_reply))

    except Exception as e:
        _log.warning("[ai_push] failed tenant=%s: %s", tenant_id, e)


@router.post("/webhook")
async def line_webhook(request: Request, background_tasks: BackgroundTasks):
    body = await request.body()
    sig_header = request.headers.get("X-Line-Signature", "")
    tenant_id = request.query_params.get("tenant", "")
    if not tenant_id:
        raise HTTPException(400, "tenant param required")
    channel_secret = _get_channel_secret(tenant_id)
    if not _verify_signature(channel_secret, body, sig_header):
        raise HTTPException(400, "Invalid signature")
    channel_token = _get_channel_token(tenant_id)

    # Per-tenant webhook handles persistence + bot reply directly here (:8000).
    # Fan-out to :8003 was removed to avoid double-insert / double-reply —
    # see /webhook/platform for the platform-OA fan-out pattern that remains.

    try:
        data = json.loads(body)
    except Exception:
        raise HTTPException(400, "Invalid JSON")
    events = data.get("events", [])
    with engine.begin() as c:
        for event in events:
            event_type   = event.get("type", "")
            source       = event.get("source", {})
            line_uid     = source.get("userId", "")
            group_id     = source.get("groupId", "")
            message_text = ""
            if event_type == "message":
                msg = event.get("message", {})
                if msg.get("type") == "text":
                    message_text = msg.get("text", "")
            c.execute(text("""
                INSERT INTO line_webhook_log
                    (id, tenant_id, event_type, line_user_id, display_name,
                     group_id, message, raw, created_at)
                VALUES
                    (:id, :tid, :etype, :luid, :dname,
                     :gid, :msg, CAST(:raw AS jsonb), NOW())
                ON CONFLICT (id) DO NOTHING
            """), {
                "id":    _new_id("lwl"),
                "tid":   tenant_id,
                "etype": event_type,
                "luid":  line_uid,
                "dname": "",
                "gid":   group_id,
                "msg":   message_text,
                "raw":   json.dumps(event),
            })

            # ── CHAT MODULE INTEGRATION ──────────────────────────
            if event_type in ("message", "follow") and line_uid:
                try:
                    # 1. get LINE profile
                    display_name, picture_url = "", ""
                    try:
                        import httpx as _httpx
                        with _httpx.Client(timeout=3) as hc:
                            pr = hc.get(
                                f"https://api.line.me/v2/bot/profile/{line_uid}",
                                headers={"Authorization": f"Bearer {channel_token}"}
                            )
                            if pr.status_code == 200:
                                pj = pr.json()
                                display_name = pj.get("displayName", "")
                                picture_url  = pj.get("pictureUrl", "")
                    except Exception:
                        pass

                    # 2. upsert chat_conversation
                    conv_row = c.execute(text("""
                        INSERT INTO chat_conversations
                            (platform, platform_uid, display_name, picture_url, tenant_id, status)
                        VALUES ('line', :uid, :name, :pic, :tid, 'open')
                        ON CONFLICT (tenant_id, platform, platform_uid) DO UPDATE
                            SET display_name = EXCLUDED.display_name,
                                picture_url  = EXCLUDED.picture_url,
                                updated_at   = now()
                        RETURNING id
                    """), {"uid": line_uid, "name": display_name,
                           "pic": picture_url, "tid": tenant_id}).fetchone()
                    conv_id = conv_row[0] if conv_row else None

                    if conv_id:
                        # 3. save inbound message
                        direction = "inbound"
                        content   = message_text if event_type == "message" else "[follow]"
                        c.execute(text("""
                            INSERT INTO chat_messages
                                (conversation_id, direction, content, raw_event)
                            VALUES (:cid, :dir, :content, CAST(:raw AS jsonb))
                        """), {"cid": conv_id, "dir": direction,
                               "content": content, "raw": json.dumps(event)})

                        # update unread + updated_at
                        c.execute(text("""
                            UPDATE chat_conversations
                            SET unread_count = unread_count + 1, updated_at = now()
                            WHERE id = :cid
                        """), {"cid": conv_id})

                        # 4. bot reply (message only)
                        if event_type == "message" and message_text:
                            reply_token = event.get("replyToken", "")
                            if not reply_token:
                                continue

                            # Idempotency: ตรวจ replyToken ซ้ำ
                            already_replied = c.execute(text("""
                                SELECT 1 FROM chat_messages
                                WHERE conversation_id = :cid
                                  AND direction = 'outbound'
                                  AND raw_event->>'replyToken' = :rt
                                LIMIT 1
                            """), {"cid": conv_id, "rt": reply_token}).fetchone()
                            if already_replied:
                                _log.info("skip duplicate replyToken %s", reply_token[:12])
                                continue

                            # AI push reply (background — ไม่บล็อก webhook response)
                            background_tasks.add_task(
                                _ai_push_reply,
                                message_text,
                                tenant_id,
                                line_uid,
                                channel_token,
                                conv_id or "",
                            )
                except Exception as e:
                    _log.warning("chat integration error tenant=%s: %s", tenant_id, e)
    return {"status": "ok"}

@router.get("/pending-uid")
def get_pending_uid(tenant: str = "", authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    target_tid = tenant if tenant else tid
    with engine.connect() as c:
        ss = c.execute(
            text("SELECT line_features FROM store_settings WHERE tenant_id=:tid LIMIT 1"),
            {"tid": target_tid}
        ).fetchone()
        current_target = ""
        if ss and ss[0]:
            features = ss[0] if isinstance(ss[0], dict) else json.loads(ss[0])
            current_target = features.get("notify_target", "")
        row = c.execute(text("""
            SELECT line_user_id, display_name, created_at
            FROM line_webhook_log
            WHERE tenant_id = :tid
              AND event_type = 'follow'
              AND line_user_id != ''
              AND line_user_id != :current
            ORDER BY created_at DESC
            LIMIT 1
        """), {"tid": target_tid, "current": current_target}).fetchone()
    if not row:
        return {"found": False, "line_user_id": "", "display_name": "", "created_at": None}
    return {"found": True, "line_user_id": row[0], "display_name": row[1], "created_at": str(row[2])}

@router.post("/push-quote")
async def push_quote(request: Request, payload: dict, authorization: str = Header("")):
    # รองรับทั้ง JWT auth และ ?tenant= param (สำหรับ public catalog)
    tenant_param = request.query_params.get("tenant", "")
    if tenant_param:
        tid = tenant_param
    else:
        tid, _ = get_tenant_user(authorization)
    products     = payload.get("products", [])
    line_user_id = payload.get("line_user_id", "")
    if not products:
        raise HTTPException(400, "ไม่มีสินค้า")

    with engine.connect() as c:
        ss  = c.execute(text("SELECT * FROM store_settings WHERE tenant_id=:tid"), {"tid": tid}).fetchone()
        ls  = c.execute(text("SELECT * FROM line_settings WHERE tenant_id=:tid"), {"tid": tid}).fetchone()

    if not ss:
        raise HTTPException(400, "ไม่พบ store settings")

    store = dict(ss._mapping)
    # merge line_settings fields into store for render_quote_jpg
    if ls:
        ld = dict(ls._mapping)
        store["line_quote_qr_url"]  = ld.get("quote_qr_url","")
        store["line_quote_contact"] = ld.get("quote_contact","")
        store["line_quote_note"]    = ld.get("quote_note","")
        store["line_channel_token"] = ld.get("channel_token","")
    channel_token = store.get("line_channel_token", "")
    banks = []

    jpg_bytes = render_quote_jpg(store, products, banks)
    if not jpg_bytes:
        raise HTTPException(500, "render ภาพไม่สำเร็จ")

    import os as _os
    quote_dir = "/home/viivadmin/viiv/uploads/quotes/{}".format(tid)
    _os.makedirs(quote_dir, exist_ok=True)
    img_fname = "quote_{}.jpg".format(_new_id("q"))
    img_path  = "{}/{}".format(quote_dir, img_fname)
    with open(img_path, "wb") as f:
        f.write(jpg_bytes)
    img_url = "https://concore.viiv.me/uploads/quotes/{}/{}".format(tid, img_fname)

    if not line_user_id or not channel_token:
        import base64
        return {"ok": False, "reason": "no_line_config", "img_url": img_url}

    result = push_image_to_line(channel_token, line_user_id, img_url)
    result["img_url"] = img_url
    return result


# ── Platform LINE OA webhook ──────────────────────────────────────────────────
# Separate from per-tenant /webhook above — platform-level OA used to activate
# pending tenants by replying with their registered email.
#
# Architecture: LINE Console → concore.viiv.me/api/line/webhook/platform (this :8000 router)
#   - follow + email activation logic stays here (existing behaviour)
#   - every event ALSO fire-and-forget forwarded to modules.chat (:8003) so
#     it can persist the conversation. modules.chat trusts X-Forwarded-From
#     internal header instead of re-verifying the signature.

import asyncio
import logging
import httpx as _httpx
_log = logging.getLogger("pos_line")

CHAT_FORWARD_URL = "http://localhost:8003/chat/webhook/line/platform"


async def _forward_to_chat_module(body: bytes, signature: str) -> None:
    """Fire-and-forget POST to modules.chat. Never raises — LINE must always
    receive 200 from us regardless of internal forwarding status."""
    try:
        async with _httpx.AsyncClient(timeout=3.0) as c:
            await c.post(
                CHAT_FORWARD_URL,
                content=body,
                headers={
                    "Content-Type":      "application/json",
                    "X-Line-Signature":  signature,
                    "X-Forwarded-From":  "viiv-internal",
                },
            )
    except Exception as e:
        _log.warning("forward to chat module failed: %s", e)


def _line_reply_text(channel_token: str, reply_token: str, msg: str) -> None:
    if not channel_token or not reply_token:
        return
    try:
        import requests
        requests.post(
            "https://api.line.me/v2/bot/message/reply",
            headers={
                "Authorization": f"Bearer {channel_token}",
                "Content-Type": "application/json",
            },
            json={
                "replyToken": reply_token,
                "messages": [{"type": "text", "text": msg}],
            },
            timeout=5,
        )
    except Exception:
        pass


@router.post("/webhook/platform")
async def line_platform_webhook(request: Request):
    body = await request.body()
    sig_header = request.headers.get("X-Line-Signature", "")

    try:
        data = json.loads(body) if body else {}
    except Exception:
        data = {}
    events = data.get("events", []) or []

    # LINE Manager verify endpoint sends empty events — accept without signature.
    if not events:
        return {"status": "ok"}

    with engine.connect() as c:
        row = c.execute(text(
            "SELECT channel_secret, channel_token FROM platform_connections "
            "WHERE platform='line' LIMIT 1"
        )).fetchone()
    if not row or not row[0]:
        raise HTTPException(500, "platform LINE credentials missing")
    channel_secret, channel_token = row[0], row[1]

    if not _verify_signature(channel_secret, body, sig_header):
        raise HTTPException(400, "Invalid signature")

    # Fan-out: forward original body + signature to modules.chat (:8003)
    # for persistence/inbox. Background task — does NOT block our reply.
    try:
        asyncio.create_task(_forward_to_chat_module(body, sig_header))
    except Exception as e:
        _log.warning("forward task creation failed: %s", e)

    for ev in events:
        etype       = ev.get("type")
        reply_token = ev.get("replyToken", "")
        line_uid    = (ev.get("source") or {}).get("userId", "")

        if etype == "follow":
            _line_reply_text(channel_token, reply_token,
                "ยินดีต้อนรับสู่ ViiV! 🎉\n"
                "กรุณาพิมพ์อีเมล์ที่ใช้สมัครเพื่อเปิดใช้งานร้านค้าครับ")
            continue

        if etype == "message":
            msg = ev.get("message") or {}
            if msg.get("type") != "text":
                continue
            text_in = (msg.get("text") or "").strip()
            if "@" not in text_in:
                continue  # not an email — silent (don't spam users)
            email = text_in.lower()

            with engine.begin() as c:
                hit = c.execute(text(
                    "SELECT id, subdomain FROM tenants "
                    "WHERE LOWER(email)=:e AND status='pending' LIMIT 1"
                ), {"e": email}).fetchone()
                if hit:
                    tid, subdomain = hit[0], hit[1]
                    c.execute(text(
                        "UPDATE tenants SET status='active', line_uid=:luid, "
                        "updated_at=NOW() WHERE id=:tid"
                    ), {"luid": line_uid, "tid": tid})
                    _line_reply_text(channel_token, reply_token,
                        f"✅ เปิดใช้งานแล้วครับ!\n"
                        f"เข้าระบบได้เลยที่:\n"
                        f"https://{subdomain}.viiv.me/superboard/")
                else:
                    _line_reply_text(channel_token, reply_token,
                        "ไม่พบอีเมล์นี้ในระบบครับ หรืออาจเปิดใช้งานแล้ว\n"
                        "ติดต่อ @004krtts ได้เลยครับ")

    return {"status": "ok"}
