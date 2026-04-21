# pos_line_settings.py — LINE Settings API (แยกจาก store_settings)

import os, json, jwt
from fastapi import APIRouter, Header, HTTPException, UploadFile, File
from sqlalchemy import text
from app.core.db import engine

router = APIRouter()
JWT_SECRET = os.getenv("JWT_SECRET", "")

def get_tenant(authorization=""):
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"],
            options={"leeway":864000,"verify_exp":False})
        uid = payload.get("sub"); tid = payload.get("tenant_id")
        with engine.connect() as c:
            if not tid and uid:
                u = c.execute(text("SELECT email FROM users WHERE id=:uid LIMIT 1"),{"uid":uid}).fetchone()
                if u:
                    t = c.execute(text("SELECT id FROM tenants WHERE email=:e LIMIT 1"),{"e":u[0]}).fetchone()
                    if t: tid = t[0]
            if not tid and payload.get("role")=="admin":
                t = c.execute(text("SELECT id FROM tenants ORDER BY created_at LIMIT 1")).fetchone()
                if t: tid = t[0]
        if tid: return tid
    except: pass
    raise HTTPException(401, "Unauthorized")

def _ensure(conn, tid):
    ex = conn.execute(text("SELECT 1 FROM line_settings WHERE tenant_id=:tid"),{"tid":tid}).fetchone()
    if not ex:
        conn.execute(text("INSERT INTO line_settings(tenant_id) VALUES(:tid)"),{"tid":tid})

def _row_to_dict(r):
    if not r: return {}
    d = dict(r._mapping)
    d["updated_at"] = d["updated_at"].isoformat() if d.get("updated_at") else ""
    return d

@router.get("/settings")
def get_line_settings(authorization: str = Header("")):
    tid = get_tenant(authorization)
    with engine.connect() as c:
        r = c.execute(text("SELECT * FROM line_settings WHERE tenant_id=:tid"),{"tid":tid}).fetchone()
    if not r:
        return {"tenant_id":tid,"oa_id":"","channel_token":"","channel_secret":"",
                "feature_bill":True,"feature_quote":True,"feature_chat":True,"feature_order":False,
                "chat_label":"Chat","chat_action":"add","notify_target":"",
                "notify_on_order":True,"notify_on_bill":False,
                "quote_qr_url":"","quote_contact":"",
                "quote_note":"ใบเสนอราคานี้มีผล 7 วัน ขอสงวนสิทธิ์ในการเปลี่ยนแปลงทุกกรณี"}
    return _row_to_dict(r)

@router.post("/credentials")
def save_credentials(payload: dict, authorization: str = Header("")):
    tid = get_tenant(authorization)
    oa_id  = str(payload.get("oa_id","")).strip().lstrip("@")
    token  = str(payload.get("channel_token","")).strip()
    secret = str(payload.get("channel_secret","")).strip()
    if not oa_id or not token or not secret:
        raise HTTPException(400, "กรุณากรอก OA ID, Token และ Secret ให้ครบ")
    with engine.begin() as c:
        _ensure(c, tid)
        c.execute(text("""UPDATE line_settings SET
            oa_id=:oa, channel_token=:tok, channel_secret=:sec, updated_at=NOW()
            WHERE tenant_id=:tid"""),
            {"oa":oa_id,"tok":token,"sec":secret,"tid":tid})
    return {"message":"success"}

@router.post("/features")
def save_features(payload: dict, authorization: str = Header("")):
    tid = get_tenant(authorization)
    with engine.begin() as c:
        _ensure(c, tid)
        c.execute(text("""UPDATE line_settings SET
            feature_bill=:fb, feature_quote=:fq, feature_chat=:fc, feature_order=:fo,
            chat_label=:cl, chat_action=:ca,
            notify_target=:nt, notify_on_order=:no, notify_on_bill=:nb,
            updated_at=NOW()
            WHERE tenant_id=:tid"""), {
            "fb": bool(payload.get("feature_bill", True)),
            "fq": bool(payload.get("feature_quote", True)),
            "fc": bool(payload.get("feature_chat", True)),
            "fo": bool(payload.get("feature_order", False)),
            "cl": str(payload.get("chat_label","Chat"))[:10],
            "ca": str(payload.get("chat_action","add")),
            "nt": str(payload.get("notify_target","")),
            "no": bool(payload.get("notify_on_order", True)),
            "nb": bool(payload.get("notify_on_bill", False)),
            "tid": tid
        })
    return {"message":"success"}

@router.post("/quote-config")
def save_quote_config(payload: dict, authorization: str = Header("")):
    tid = get_tenant(authorization)
    with engine.begin() as c:
        _ensure(c, tid)
        c.execute(text("""UPDATE line_settings SET
            quote_qr_url=:qr, quote_contact=:qc, quote_note=:qn, updated_at=NOW()
            WHERE tenant_id=:tid"""), {
            "qr":  str(payload.get("quote_qr_url","")),
            "qc":  str(payload.get("quote_contact","")),
            "qn":  str(payload.get("quote_note","ใบเสนอราคานี้มีผล 7 วัน ขอสงวนสิทธิ์ในการเปลี่ยนแปลงทุกกรณี")),
            "tid": tid
        })
    return {"message":"success"}

@router.post("/upload-quote-qr")
async def upload_quote_qr(file: UploadFile = File(...), authorization: str = Header("")):
    tid = get_tenant(authorization)
    content = await file.read()
    if len(content) > 5*1024*1024:
        raise HTTPException(400, "ไฟล์ใหญ่เกิน 5MB")
    ext = (file.filename or "qr.png").rsplit(".",1)[-1].lower()
    fname = f"line_quote_qr_{tid}.{ext}"
    qr_dir = "/home/viivadmin/viiv/uploads/store/qr"
    os.makedirs(qr_dir, exist_ok=True)
    fpath = os.path.join(qr_dir, fname)
    with open(fpath,"wb") as f: f.write(content)
    url = f"/uploads/store/qr/{fname}"
    with engine.begin() as c:
        _ensure(c, tid)
        c.execute(text("UPDATE line_settings SET quote_qr_url=:url WHERE tenant_id=:tid"),{"url":url,"tid":tid})
    return {"url": url}

@router.get("/public")
def get_line_public(tenant: str = ""):
    if not tenant: raise HTTPException(400, "tenant required")
    with engine.connect() as c:
        r = c.execute(text("SELECT oa_id,feature_chat,feature_quote,chat_label,chat_action FROM line_settings WHERE tenant_id=:tid"),{"tid":tenant}).fetchone()
    if not r: return {}
    return dict(r._mapping)
