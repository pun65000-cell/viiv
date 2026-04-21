from app.api.pos_line_quote import render_quote_jpg, push_image_to_line
# app/api/pos_line.py
# LINE Integration v1.11

import hmac, hashlib, base64, json, os, random, string, time
import jwt
from fastapi import APIRouter, Request, Header, HTTPException
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

@router.post("/webhook")
async def line_webhook(request: Request):
    body = await request.body()
    sig_header = request.headers.get("X-Line-Signature", "")
    tenant_id = request.query_params.get("tenant", "")
    if not tenant_id:
        raise HTTPException(400, "tenant param required")
    channel_secret = _get_channel_secret(tenant_id)
    if not _verify_signature(channel_secret, body, sig_header):
        raise HTTPException(400, "Invalid signature")
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
                     :gid, :msg, :raw::jsonb, NOW())
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

