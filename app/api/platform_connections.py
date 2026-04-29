# platform_connections.py — Platform-level connection management

import os, jwt, shutil, uuid
from fastapi import APIRouter, Header, HTTPException, UploadFile, File
from sqlalchemy import text
from app.core.db import engine

router = APIRouter()
JWT_SECRET = os.getenv("JWT_SECRET", "21cc8b2ff8e25e6262effb2b47b15c39fb16438525b6d041bb842a130c08be7c")
UPLOAD_DIR = "/home/viivadmin/viiv/frontend/platform/uploads"
UPLOAD_URL = "/platform/uploads"

os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── Auth ──────────────────────────────────────────────────────────────────────
def _admin_auth(authorization: str):
    try:
        tok = authorization.replace("Bearer ", "").strip()
        payload = jwt.decode(tok, JWT_SECRET, algorithms=["HS256"],
                             options={"leeway": 864000, "verify_exp": False})
        if payload.get("is_admin") or payload.get("role") in ("admin", "superadmin"):
            return payload
        # allow tenant_id-based tokens for now (dev)
        if payload.get("tenant_id") or payload.get("sub"):
            return payload
    except Exception:
        pass
    raise HTTPException(401, "Unauthorized")

# ── DB bootstrap ──────────────────────────────────────────────────────────────
def _bootstrap():
    with engine.begin() as c:
        c.execute(text("""
            CREATE TABLE IF NOT EXISTS platform_connections (
                id           SERIAL PRIMARY KEY,
                platform     VARCHAR(50)  NOT NULL DEFAULT 'line',
                oa_id        VARCHAR(200) DEFAULT '',
                channel_token TEXT        DEFAULT '',
                channel_secret TEXT       DEFAULT '',
                qr_image_url TEXT         DEFAULT '',
                qr_link_url  TEXT         DEFAULT '',
                webhook_url  TEXT         DEFAULT '',
                is_active    BOOLEAN      DEFAULT TRUE,
                created_at   TIMESTAMPTZ  DEFAULT NOW(),
                updated_at   TIMESTAMPTZ  DEFAULT NOW()
            )
        """))
        # ensure one row per platform
        for pl in ("line", "facebook", "tiktok", "instagram", "youtube"):
            exists = c.execute(
                text("SELECT 1 FROM platform_connections WHERE platform=:p"),
                {"p": pl}
            ).fetchone()
            if not exists:
                c.execute(
                    text("INSERT INTO platform_connections(platform) VALUES(:p)"),
                    {"p": pl}
                )

_bootstrap()

# ── Helpers ───────────────────────────────────────────────────────────────────
def _row(r):
    if not r: return {}
    d = dict(r._mapping)
    for k in ("created_at", "updated_at"):
        if d.get(k): d[k] = d[k].isoformat()
    return d

# ── GET all connections ────────────────────────────────────────────────────────
@router.get("/connections")
def get_connections(authorization: str = Header("")):
    _admin_auth(authorization)
    with engine.connect() as c:
        rows = c.execute(text(
            "SELECT * FROM platform_connections ORDER BY id"
        )).fetchall()
    return [_row(r) for r in rows]

# ── GET single platform ────────────────────────────────────────────────────────
@router.get("/connections/{platform}")
def get_connection(platform: str, authorization: str = Header("")):
    _admin_auth(authorization)
    with engine.connect() as c:
        r = c.execute(text(
            "SELECT * FROM platform_connections WHERE platform=:p"
        ), {"p": platform}).fetchone()
    if not r:
        return {"platform": platform, "oa_id": "", "channel_token": "",
                "channel_secret": "", "qr_image_url": "", "qr_link_url": "",
                "webhook_url": "", "is_active": False}
    return _row(r)

# ── SAVE credentials ──────────────────────────────────────────────────────────
@router.post("/connections/{platform}")
def save_connection(platform: str, body: dict, authorization: str = Header("")):
    _admin_auth(authorization)
    with engine.begin() as c:
        c.execute(text("""
            INSERT INTO platform_connections(platform, oa_id, channel_token, channel_secret,
                qr_link_url, webhook_url, is_active)
            VALUES(:p, :oa, :tok, :sec, :ql, :wh, :act)
            ON CONFLICT DO NOTHING
        """), {"p": platform, "oa": "", "tok": "", "sec": "",
               "ql": "", "wh": "", "act": True})
        c.execute(text("""
            UPDATE platform_connections SET
                oa_id          = COALESCE(:oa,  oa_id),
                channel_token  = COALESCE(:tok, channel_token),
                channel_secret = COALESCE(:sec, channel_secret),
                qr_link_url    = COALESCE(:ql,  qr_link_url),
                webhook_url    = COALESCE(:wh,  webhook_url),
                is_active      = :act,
                updated_at     = NOW()
            WHERE platform = :p
        """), {
            "p":   platform,
            "oa":  body.get("oa_id")         or None,
            "tok": body.get("channel_token") or None,
            "sec": body.get("channel_secret")or None,
            "ql":  body.get("qr_link_url")   or None,
            "wh":  body.get("webhook_url")   or None,
            "act": body.get("is_active", True),
        })
        r = c.execute(text(
            "SELECT * FROM platform_connections WHERE platform=:p"
        ), {"p": platform}).fetchone()
    return {"ok": True, "data": _row(r)}

# ── UPLOAD QR image ────────────────────────────────────────────────────────────
@router.post("/connections/{platform}/upload-qr")
async def upload_qr(platform: str, file: UploadFile = File(...),
                    authorization: str = Header("")):
    _admin_auth(authorization)
    ext = os.path.splitext(file.filename or "qr.png")[1] or ".png"
    fname = f"qr_{platform}_{uuid.uuid4().hex[:8]}{ext}"
    fpath = os.path.join(UPLOAD_DIR, fname)
    with open(fpath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    url = f"{UPLOAD_URL}/{fname}"
    with engine.begin() as c:
        c.execute(text("""
            UPDATE platform_connections SET qr_image_url=:url, updated_at=NOW()
            WHERE platform=:p
        """), {"url": url, "p": platform})
    return {"ok": True, "url": url}

# ── DELETE QR image ───────────────────────────────────────────────────────────
@router.delete("/connections/{platform}/qr")
def delete_qr(platform: str, authorization: str = Header("")):
    _admin_auth(authorization)
    with engine.begin() as c:
        r = c.execute(text(
            "SELECT qr_image_url FROM platform_connections WHERE platform=:p"
        ), {"p": platform}).fetchone()
        if r and r[0]:
            fname = r[0].split("/")[-1]
            fpath = os.path.join(UPLOAD_DIR, fname)
            if os.path.exists(fpath):
                os.remove(fpath)
        c.execute(text(
            "UPDATE platform_connections SET qr_image_url='', updated_at=NOW() WHERE platform=:p"
        ), {"p": platform})
    return {"ok": True}
