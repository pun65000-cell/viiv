# platform_connections.py — Platform-level connection management

import os, jwt, shutil, uuid, datetime
from fastapi import APIRouter, Header, HTTPException, UploadFile, File
from sqlalchemy import text
from app.core.db import engine

router = APIRouter()
JWT_SECRET = os.getenv("JWT_SECRET", "21cc8b2ff8e25e6262effb2b47b15c39fb16438525b6d041bb842a130c08be7c")
UPLOAD_DIR = "/home/viivadmin/viiv/frontend/platform/uploads"
UPLOAD_URL = "https://viiv.me/platform/uploads"

os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── Identity ──────────────────────────────────────────────────────────────────
@router.get("/me")
def get_me(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return {
            "user_id": payload.get("user_id"),
            "email":   payload.get("email"),
            "role":    payload.get("role", "owner"),
        }
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


# ── Health / Overview ─────────────────────────────────────────────────────────
@router.get("/health")
def platform_health():
    return {"status": "ok", "version": "1.54"}


@router.get("/overview")
def platform_overview(authorization: str = Header(None)):
    _admin_auth(authorization)
    with engine.connect() as c:
        t = c.execute(text("""
            SELECT
              COUNT(*)                                                                          AS total,
              COUNT(*) FILTER (WHERE status = 'active')                                         AS active,
              COUNT(*) FILTER (WHERE status = 'pending')                                        AS pending,
              COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)                           AS new_today,
              COUNT(*) FILTER (WHERE date_trunc('month', created_at)
                                   = date_trunc('month', CURRENT_DATE))                         AS new_this_month
            FROM tenants
        """)).mappings().first()

        a = c.execute(text("""
            SELECT
              COUNT(*)                              AS total,
              COUNT(*) FILTER (WHERE is_active)     AS active
            FROM viiv_accounts
        """)).mappings().first()

        rows = c.execute(text("""
            SELECT package_id, COUNT(*) AS cnt
            FROM tenants
            GROUP BY package_id
        """)).mappings().all()
        pkg = {"pkg_basic": 0, "pkg_standard": 0, "pkg_pro": 0}
        for r in rows:
            key = r["package_id"]
            if key in pkg:
                pkg[key] = int(r["cnt"])

        act = c.execute(text("""
            SELECT COUNT(DISTINCT tenant_id) AS shops_active_7d
            FROM tenant_staff
            WHERE last_seen >= NOW() - INTERVAL '7 days'
        """)).mappings().first()

    return {
        "tenants": {
            "total":          int(t["total"]),
            "active":         int(t["active"]),
            "pending":        int(t["pending"]),
            "new_today":      int(t["new_today"]),
            "new_this_month": int(t["new_this_month"]),
        },
        "accounts": {
            "total":  int(a["total"]),
            "active": int(a["active"]),
        },
        "packages": pkg,
        "activity": {
            "shops_active_7d": int(act["shops_active_7d"]),
        },
    }


@router.post("/cache/clear-subdomain/{subdomain}")
def clear_subdomain_cache(subdomain: str, authorization: str = Header(None)):
    _admin_auth(authorization)
    from app.main import _clear_cached_tenant
    cleared = _clear_cached_tenant(subdomain.lower())
    return {"cleared": subdomain, "had_entry": cleared}


# ── Auth ──────────────────────────────────────────────────────────────────────
def _admin_auth(authorization: str):
    """Permissive auth (dev): ผ่านถ้า decode JWT ได้และมี identity field ใดๆ
    field ที่ยอมรับ: is_admin, role∈{admin,superadmin}, tenant_id, sub, user_id, email
    (token จาก /api/platform/login เก่ามี user_id แต่ไม่มี sub —
    fix นี้ทำให้ใช้งานได้โดยไม่ต้อง force re-login)"""
    try:
        tok = authorization.replace("Bearer ", "").strip()
        payload = jwt.decode(tok, JWT_SECRET, algorithms=["HS256"],
                             options={"leeway": 864000, "verify_exp": False})
        if payload.get("is_admin") or payload.get("role") in ("admin", "superadmin"):
            return payload
        if (payload.get("tenant_id") or payload.get("sub")
                or payload.get("user_id") or payload.get("email")):
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

# ── PKG Config bootstrap ──────────────────────────────────────────────────────
_DEFAULT_MODULES = [
    {"id":"pos",      "name":"POS",       "icon":"🖥",  "description":"ระบบขายหน้าร้าน จัดการสินค้า สต็อก",         "locked":True},
    {"id":"affiliate","name":"Affiliate", "icon":"🔗",  "description":"ระบบ Affiliate แนะนำ-รับค่าคอมมิชชัน",       "locked":True},
    {"id":"chat",     "name":"Chat",      "icon":"💬",  "description":"AI ปิดการขายใน DM keyword trigger",          "locked":False},
    {"id":"autopost", "name":"Auto Post", "icon":"📲",  "description":"โพสต์อัตโนมัติทุก platform",                  "locked":False},
]
_DEFAULT_PLANS = [
    {"id":"trial",    "name":"ทดลองใช้ฟรี",     "badge":"แนะนำ", "price":0,    "unit":"ฟรี 10 วัน", "features":"ทุกโมดูลครบ\nไม่ต้องใช้บัตรเครดิต", "is_free":True,  "is_custom":False},
    {"id":"starter",  "name":"เริ่มต้น",          "badge":"",      "price":599,  "unit":"/เดือน",    "features":"1 ร้าน · AI Basic\n500 credits/เดือน",               "is_free":False, "is_custom":False},
    {"id":"business", "name":"ธุรกิจออนไลน์",     "badge":"",      "price":1099, "unit":"/เดือน",    "features":"3 ร้าน · AI Pro\n2,000 credits/เดือน",              "is_free":False, "is_custom":False},
    {"id":"pro",      "name":"มืออาชีพ",          "badge":"",      "price":1699, "unit":"/เดือน",    "features":"10 ร้าน · AI Max\n5,000 credits/เดือน",             "is_free":False, "is_custom":False},
    {"id":"privacy",  "name":"Privacy",           "badge":"Custom","price":3459, "unit":"",           "features":"เริ่มต้น 3,459฿ ปรับตามความต้องการ",                  "is_free":False, "is_custom":True},
]

def _bootstrap_pkg():
    import json as _json
    with engine.begin() as c:
        c.execute(text("""
            CREATE TABLE IF NOT EXISTS platform_pkg_config (
                id           SERIAL PRIMARY KEY,
                config_key   VARCHAR(50) UNIQUE NOT NULL,
                config_value JSONB NOT NULL DEFAULT '{}',
                updated_at   TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        for key, val in [("modules", _DEFAULT_MODULES), ("plans", _DEFAULT_PLANS)]:
            exists = c.execute(text(
                "SELECT 1 FROM platform_pkg_config WHERE config_key=:k"), {"k": key}
            ).fetchone()
            if not exists:
                c.execute(text(
                    "INSERT INTO platform_pkg_config(config_key, config_value) VALUES(:k, CAST(:v AS jsonb))"
                ), {"k": key, "v": _json.dumps(val, ensure_ascii=False)})

_bootstrap_pkg()

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

@router.get("/connections/{platform}/public")
def get_connection_public(platform: str):
    with engine.connect() as c:
        row = c.execute(
            text("SELECT oa_id, qr_image_url, qr_link_url FROM platform_connections WHERE platform=:p"),
            {"p": platform}
        ).fetchone()
        if not row:
            return {}
        d = dict(row._mapping)
        oa = d.get("oa_id") or ""
        return {
            "oa_id": oa,
            "qr_image_url": d.get("qr_image_url") or "",
            "qr_link_url": d.get("qr_link_url") or (("https://line.me/R/ti/p/%40" + oa) if oa else "")
        }
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

# ── PKG Config GET (public — price data shown to customers) ───────────────────
@router.get("/pkg-config")
def get_pkg_config(authorization: str = Header("")):
    with engine.connect() as c:
        rows = c.execute(text(
            "SELECT config_key, config_value FROM platform_pkg_config"
        )).fetchall()
    result = {}
    for r in rows:
        result[r[0]] = r[1]
    return result

# ── PKG Config POST ────────────────────────────────────────────────────────────
@router.post("/pkg-config")
def save_pkg_config(body: dict, authorization: str = Header("")):
    import json as _json
    _admin_auth(authorization)
    with engine.begin() as c:
        for key in ("modules", "plans"):
            val = body.get(key)
            if val is not None:
                c.execute(text("""
                    INSERT INTO platform_pkg_config(config_key, config_value)
                    VALUES(:k, CAST(:v AS jsonb))
                    ON CONFLICT (config_key) DO UPDATE
                    SET config_value=EXCLUDED.config_value, updated_at=NOW()
                """), {"k": key, "v": _json.dumps(val, ensure_ascii=False)})
    return {"ok": True}

# ── My Shops ──────────────────────────────────────────────────────────────────
@router.get("/my-shops")
def my_shops(authorization: str = Header("")):
    """รองรับ token 2 แบบ:
      • platform-login JWT: sub=pfu_xxx, มี email — ใช้ตรงๆ
      • staff-login JWT:    sub=stf_xxx, ไม่มี email — resolve email จาก
        tenant_staff.id แล้วหา viiv_accounts.id (pfu) จาก email"""
    try:
        tok = authorization.replace("Bearer ", "").strip()
        payload = jwt.decode(tok, JWT_SECRET, algorithms=["HS256"],
                             options={"leeway": 864000, "verify_exp": False})
        sub   = payload.get("sub") or payload.get("user_id") or ""
        email = payload.get("email") or ""
        if not sub and not email:
            raise ValueError("no identity")
    except Exception:
        raise HTTPException(401, "Unauthorized")

    with engine.connect() as c:
        # ── Resolve email + owner_uid (= viiv_accounts.id) ──
        # staff-login JWT ไม่มี email → ดึงจาก tenant_staff
        if not email and sub:
            r = c.execute(text(
                "SELECT email FROM tenant_staff WHERE id=:sid LIMIT 1"
            ), {"sid": sub}).fetchone()
            if r:
                email = r.email or ""

        # owner_id ใน tenants เก็บเป็น pfu_xxx — หา pfu จาก email หรือใช้ sub ถ้าเป็น pfu อยู่แล้ว
        owner_uid = sub if sub and sub.startswith("pfu_") else ""
        if not owner_uid and email:
            r = c.execute(text(
                "SELECT id FROM viiv_accounts WHERE email=:em LIMIT 1"
            ), {"em": email}).fetchone()
            if r:
                owner_uid = r.id or ""

        owned = []
        if owner_uid:
            owned = c.execute(text("""
                SELECT id, store_name, subdomain, status
                FROM tenants WHERE owner_id=:uid ORDER BY created_at
            """), {"uid": owner_uid}).fetchall()

        staffed = []
        if email:
            staffed = c.execute(text("""
                SELECT t.id, t.store_name, t.subdomain, t.status, ts.role
                FROM tenant_staff ts
                JOIN tenants t ON t.id = ts.tenant_id
                WHERE ts.email=:email AND ts.is_active=true
            """), {"email": email}).fetchall()

    shops = []
    seen = set()
    for s in owned:
        seen.add(s.id)
        shops.append({"id": s.id, "store_name": s.store_name,
                      "subdomain": s.subdomain, "status": s.status, "role": "owner"})
    for s in staffed:
        if s.id not in seen:
            shops.append({"id": s.id, "store_name": s.store_name,
                          "subdomain": s.subdomain, "status": s.status, "role": s.role})
    return shops


# ── Join Shop ────────────────────────────────────────────────────────────────
def _decode_user(authorization: str):
    """Decode Bearer JWT → return (sub, identity_row).
    รองรับ token 2 แบบ:
      • staff-login (sub = stf_xxx) → ดึง tenant_staff ตรงๆ
      • platform-login (sub = pfu_xxx, email ใน payload) → match ผ่าน email
        หรือ fallback ไป viiv_accounts (กรณียังไม่มี tenant_staff row)"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "No token")
    try:
        payload = jwt.decode(authorization.split(" ", 1)[1], JWT_SECRET, algorithms=["HS256"])
    except Exception:
        raise HTTPException(401, "Invalid token")
    sub = payload.get("sub") or payload.get("user_id")
    email_jwt = payload.get("email")
    if not sub and not email_jwt:
        raise HTTPException(401, "Invalid token payload")

    with engine.connect() as c:
        row = None
        # 1) staff-login token: sub = tenant_staff.id
        if sub:
            row = c.execute(text("""
                SELECT id, email, first_name, last_name, hashed_password,
                       phone, avatar_url, role
                FROM tenant_staff WHERE id=:sid LIMIT 1
            """), {"sid": sub}).fetchone()
        # 2) platform-login token: sub = viiv_accounts.id, email ใน payload
        #    user ที่ register แล้วจะมี tenant_staff row จาก register_shop fix
        if not row and email_jwt:
            row = c.execute(text("""
                SELECT id, email, first_name, last_name, hashed_password,
                       phone, avatar_url, role
                FROM tenant_staff
                WHERE email=:em AND is_active=true
                ORDER BY created_at LIMIT 1
            """), {"em": email_jwt}).fetchone()
        # 3) fallback: ดึง identity จาก viiv_accounts (กรณีไม่มี tenant_staff เลย)
        if not row and sub:
            va = c.execute(text("""
                SELECT id, email, full_name, hashed_password
                FROM viiv_accounts WHERE id=:sid LIMIT 1
            """), {"sid": sub}).fetchone()
            if va:
                import types as _t
                parts = (va.full_name or "").strip().split(" ", 1)
                row = _t.SimpleNamespace(
                    id=va.id, email=va.email,
                    first_name=parts[0] if parts and parts[0] else "",
                    last_name=parts[1] if len(parts) > 1 else "",
                    hashed_password=va.hashed_password,
                    phone=None, avatar_url=None, role="owner",
                )
    if not row:
        raise HTTPException(401, "ไม่พบข้อมูลผู้ใช้")
    return sub, row


@router.post("/join-shop")
def join_shop(payload: dict, authorization: str = Header(None)):
    sub, me = _decode_user(authorization)
    subdomain = (payload.get("subdomain") or "").strip().lower()
    if not subdomain:
        raise HTTPException(400, "กรุณาระบุ Shop ID")

    with engine.begin() as c:
        tenant = c.execute(text("""
            SELECT id, store_name, subdomain
            FROM tenants WHERE LOWER(subdomain)=:s
        """), {"s": subdomain}).fetchone()
        if not tenant:
            raise HTTPException(404, "ไม่พบร้านนี้ในระบบ")

        existing = c.execute(text("""
            SELECT id, role FROM tenant_staff
            WHERE tenant_id=:tid AND email=:email AND is_active=true
        """), {"tid": tenant.id, "email": me.email}).fetchone()

        if existing:
            new_id = existing.id
            role = existing.role
        else:
            new_id = "stf_" + uuid.uuid4().hex[:12]
            role = "staff"
            c.execute(text("""
                INSERT INTO tenant_staff (
                    id, tenant_id, first_name, last_name, email, phone,
                    role, hashed_password, permissions, avatar_url,
                    is_active, created_at, updated_at
                ) VALUES (
                    :id, :tid, :fn, :ln, :em, :ph,
                    :role, :hpw, '{}'::jsonb, :av,
                    true, NOW(), NOW()
                )
            """), {
                "id": new_id, "tid": tenant.id,
                "fn": me.first_name or "", "ln": me.last_name or "",
                "em": me.email, "ph": me.phone,
                "role": role, "hpw": me.hashed_password,
                "av": me.avatar_url,
            })

    name = f"{me.first_name or ''} {me.last_name or ''}".strip() or me.email
    new_token = jwt.encode({
        "sub": new_id,
        "tenant_id": tenant.id,
        "role": role,
        "name": name,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=30),
    }, JWT_SECRET, algorithm="HS256")

    return {
        "access_token": new_token,
        "token_type":   "bearer",
        "tenant_id":    tenant.id,
        "subdomain":    tenant.subdomain,
        "store_name":   tenant.store_name,
        "role":         role,
    }


@router.delete("/my-shops/{tenant_id}")
def remove_shop(tenant_id: str, authorization: str = Header(None)):
    sub, me = _decode_user(authorization)

    with engine.begin() as c:
        tenant = c.execute(text(
            "SELECT id, owner_id FROM tenants WHERE id=:tid"
        ), {"tid": tenant_id}).fetchone()
        if not tenant:
            raise HTTPException(404, "ไม่พบร้านนี้")

        # Owner check — match owner_id ↔ any tenant_staff row ของ user คนนี้
        if tenant.owner_id:
            owner_match = c.execute(text("""
                SELECT 1 FROM tenant_staff
                WHERE id=:oid AND email=:email
            """), {"oid": tenant.owner_id, "email": me.email}).fetchone()
            if owner_match:
                raise HTTPException(403, "เจ้าของร้านลบร้านตัวเองไม่ได้")

        deleted = c.execute(text("""
            DELETE FROM tenant_staff
            WHERE tenant_id=:tid AND email=:email
        """), {"tid": tenant_id, "email": me.email}).rowcount

    if deleted == 0:
        raise HTTPException(404, "ไม่พบสมาชิกร้านนี้")
    return {"ok": True, "removed": deleted}


# ── Token Security Log ────────────────────────────────────────────────────────
@router.get("/tokens")
def list_tokens(authorization: str = Header("")):
    _admin_auth(authorization)
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT tsl.id, tsl.user_id, tsl.tenant_id, tsl.ip, tsl.user_agent,
                   tsl.action AS last_action, tsl.flagged, tsl.flagged_reason,
                   tsl.created_at AS last_seen,
                   pu.email
            FROM token_security_log tsl
            LEFT JOIN viiv_accounts pu ON pu.id = tsl.user_id
            ORDER BY tsl.created_at DESC
        """)).fetchall()
    result = []
    for r in rows:
        d = dict(r._mapping)
        if d.get("last_seen"): d["last_seen"] = d["last_seen"].isoformat()
        result.append(d)
    return result

@router.post("/tokens/{token_id}/block")
def block_token(token_id: int, authorization: str = Header("")):
    _admin_auth(authorization)
    with engine.begin() as c:
        c.execute(text("""
            UPDATE token_security_log SET flagged=true, flagged_reason='manual_block'
            WHERE id=:id
        """), {"id": token_id})
    return {"ok": True}

@router.post("/tokens/{token_id}/kick")
def kick_token(token_id: int, authorization: str = Header("")):
    _admin_auth(authorization)
    with engine.begin() as c:
        c.execute(text("DELETE FROM token_security_log WHERE id=:id"), {"id": token_id})
    return {"ok": True}

@router.delete("/tokens/{token_id}")
def delete_token_record(token_id: int, authorization: str = Header("")):
    _admin_auth(authorization)
    with engine.begin() as c:
        c.execute(text("DELETE FROM token_security_log WHERE id=:id"), {"id": token_id})
    return {"ok": True}


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
