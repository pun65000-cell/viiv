# app/api/platform_bank.py — Platform admin: Bank Accounts / Payment Gateways / Bank APIs
# Endpoints under /api/platform/*
#
# Phase 1 (5): /bank-accounts            CRUD + upload-qr
# Phase 2 (4): /payment-gateways         CRUD
# Phase 3 (5): /bank-apis                CRUD + test-connection
#
# Auth: platform JWT (admin) — _admin_auth จาก platform_connections
# Bank code whitelist: 10 codes (promptpay + 9 banks)
# is_default unique: UPDATE other rows = false ก่อน insert/update

import os, json, time, shutil, uuid
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException, UploadFile, File, Query
from sqlalchemy import text

from app.core.db import engine
from app.api.platform_connections import _admin_auth

router = APIRouter(tags=["platform-bank"])

# ─────────────────────── Constants ───────────────────────

BANK_CODES = {
    "promptpay", "kbank", "bbl", "ktb", "scb",
    "bay", "ttb", "gsb", "isbt", "baac",
}

BANK_NAME_MAP = {
    "kbank":     "กสิกรไทย",
    "bbl":       "กรุงเทพ",
    "ktb":       "กรุงไทย",
    "scb":       "ไทยพาณิชย์",
    "bay":       "กรุงศรี",
    "ttb":       "ทหารไทยธนชาต",
    "gsb":       "ออมสิน",
    "isbt":      "อิสลาม",
    "baac":      "ธ.ก.ส.",
    "promptpay": "PromptPay",
}

UPLOAD_DIR = "/home/viivadmin/viiv/uploads/platform-bank"
UPLOAD_URL_PREFIX = "/uploads/platform-bank"
MAX_QR_BYTES = 2 * 1024 * 1024  # 2MB
ALLOWED_QR_EXT = {".jpg", ".jpeg", ".png", ".webp"}

os.makedirs(UPLOAD_DIR, exist_ok=True)


# ─────────────────────── Helpers ───────────────────────

def _validate_bank_code(code: str) -> str:
    code = (code or "").strip().lower()
    if code not in BANK_CODES:
        raise HTTPException(400, f"bank_code must be one of {sorted(BANK_CODES)}")
    return code


def _iso(dt) -> Optional[str]:
    return dt.isoformat() if dt else None


def _bool(v, default: bool = False) -> bool:
    if v is None:
        return default
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        return v.lower() in ("1", "true", "yes", "on")
    return bool(v)


def _int(v, default: int = 0) -> int:
    try:
        return int(v) if v is not None else default
    except (TypeError, ValueError):
        return default


def _account_row(r) -> dict:
    return {
        "id":              r["id"],
        "bank_code":       r["bank_code"],
        "bank_name":       r["bank_name"],
        "account_no":      r["account_no"],
        "account_name":    r["account_name"],
        "branch":          r["branch"],
        "short_name":      r["short_name"],
        "qr_url":          r["qr_url"],
        "is_active":       bool(r["is_active"]),
        "is_default":      bool(r["is_default"]),
        "feature_visible": bool(r["feature_visible"]),
        "sort_order":      _int(r["sort_order"]),
        "created_at":      _iso(r["created_at"]),
        "updated_at":      _iso(r["updated_at"]),
    }


def _gateway_row(r) -> dict:
    cfg = r["config_jsonb"]
    if isinstance(cfg, str):
        try:
            cfg = json.loads(cfg)
        except Exception:
            cfg = {}
    return {
        "id":              r["id"],
        "provider_code":   r["provider_code"],
        "provider_name":   r["provider_name"],
        "api_endpoint":    r["api_endpoint"],
        "api_key_public":  r["api_key_public"],
        "api_key_secret":  r["api_key_secret"],
        "webhook_url":     r["webhook_url"],
        "is_active":       bool(r["is_active"]),
        "feature_visible": bool(r["feature_visible"]),
        "config_jsonb":    cfg or {},
        "created_at":      _iso(r["created_at"]),
        "updated_at":      _iso(r["updated_at"]),
    }


def _bankapi_row(r) -> dict:
    cfg = r["config_jsonb"]
    if isinstance(cfg, str):
        try:
            cfg = json.loads(cfg)
        except Exception:
            cfg = {}
    return {
        "id":                r["id"],
        "bank_code":         r["bank_code"],
        "api_endpoint":      r["api_endpoint"],
        "client_id":         r["client_id"],
        "client_secret":     r["client_secret"],
        "is_active":         bool(r["is_active"]),
        "feature_visible":   bool(r["feature_visible"]),
        "config_jsonb":      cfg or {},
        "last_check_at":     _iso(r["last_check_at"]),
        "last_check_status": r["last_check_status"],
        "created_at":        _iso(r["created_at"]),
        "updated_at":        _iso(r["updated_at"]),
    }


def _clear_default_accounts(conn, exclude_id: Optional[str] = None):
    """Set is_default=false on all rows (optionally excluding one)"""
    if exclude_id:
        conn.execute(text("""
            UPDATE platform_bank_accounts SET is_default=false, updated_at=NOW()
            WHERE is_default=true AND id <> :eid
        """), {"eid": exclude_id})
    else:
        conn.execute(text("""
            UPDATE platform_bank_accounts SET is_default=false, updated_at=NOW()
            WHERE is_default=true
        """))


# ═══════════════════════ PHASE 1 — BANK ACCOUNTS ═══════════════════════

@router.get("/bank-accounts")
def list_bank_accounts(active_only: bool = Query(False),
                       authorization: str = Header(None)):
    _admin_auth(authorization)
    where = "WHERE is_active = true" if active_only else ""
    with engine.connect() as c:
        rows = c.execute(text(f"""
            SELECT id, bank_code, bank_name, account_no, account_name,
                   branch, short_name, qr_url, is_active, is_default,
                   feature_visible, sort_order, created_at, updated_at
              FROM platform_bank_accounts
              {where}
             ORDER BY is_default DESC, sort_order ASC, created_at DESC
        """)).mappings().all()
    return {"accounts": [_account_row(r) for r in rows]}


@router.post("/bank-accounts")
def create_bank_account(payload: dict, authorization: str = Header(None)):
    _admin_auth(authorization)
    p = payload or {}
    bank_code = _validate_bank_code(p.get("bank_code"))
    bank_name = (p.get("bank_name") or BANK_NAME_MAP.get(bank_code) or "").strip()
    account_no = (p.get("account_no") or "").strip()
    account_name = (p.get("account_name") or "").strip()
    if not bank_name:
        raise HTTPException(400, "bank_name required")
    if not account_no:
        raise HTTPException(400, "account_no required")
    if not account_name:
        raise HTTPException(400, "account_name required")

    is_default = _bool(p.get("is_default"), False)
    fields = {
        "bank_code":       bank_code,
        "bank_name":       bank_name,
        "account_no":      account_no,
        "account_name":    account_name,
        "branch":          (p.get("branch") or "").strip() or None,
        "short_name":      (p.get("short_name") or "").strip() or None,
        "qr_url":          (p.get("qr_url") or "").strip() or None,
        "is_active":       _bool(p.get("is_active"), True),
        "is_default":      is_default,
        "feature_visible": _bool(p.get("feature_visible"), True),
        "sort_order":      _int(p.get("sort_order"), 0),
    }

    with engine.begin() as c:
        if is_default:
            _clear_default_accounts(c)
        cols = ", ".join(fields.keys())
        vals = ", ".join(f":{k}" for k in fields.keys())
        new_id = c.execute(text(f"""
            INSERT INTO platform_bank_accounts ({cols})
            VALUES ({vals})
            RETURNING id
        """), fields).scalar()
        row = c.execute(text("""
            SELECT id, bank_code, bank_name, account_no, account_name,
                   branch, short_name, qr_url, is_active, is_default,
                   feature_visible, sort_order, created_at, updated_at
              FROM platform_bank_accounts WHERE id=:id
        """), {"id": new_id}).mappings().first()

    return {"ok": True, "id": new_id, "account": _account_row(row)}


@router.put("/bank-accounts/{aid}")
def update_bank_account(aid: str, payload: dict, authorization: str = Header(None)):
    _admin_auth(authorization)
    p = payload or {}

    fields = {}
    if "bank_code" in p:
        fields["bank_code"] = _validate_bank_code(p["bank_code"])
        # auto-fill bank_name from map ถ้า frontend ไม่ได้ส่งมา
        if "bank_name" not in p:
            fields["bank_name"] = BANK_NAME_MAP.get(fields["bank_code"], fields["bank_code"])
    for k in ("bank_name", "account_no", "account_name"):
        if k in p:
            v = (p[k] or "").strip()
            if not v:
                raise HTTPException(400, f"{k} cannot be empty")
            fields[k] = v
    for k in ("branch", "short_name", "qr_url"):
        if k in p:
            v = (p[k] or "").strip()
            fields[k] = v if v else None
    if "is_active" in p:
        fields["is_active"] = _bool(p["is_active"], True)
    if "feature_visible" in p:
        fields["feature_visible"] = _bool(p["feature_visible"], True)
    if "sort_order" in p:
        fields["sort_order"] = _int(p["sort_order"], 0)

    set_default = "is_default" in p
    new_default = _bool(p.get("is_default"), False) if set_default else None
    if set_default:
        fields["is_default"] = new_default

    if not fields:
        raise HTTPException(400, "no editable fields")

    fields["__id__"] = aid
    set_clauses = ", ".join(f"{k}=:{k}" for k in fields if k != "__id__")

    with engine.begin() as c:
        if not c.execute(text("SELECT 1 FROM platform_bank_accounts WHERE id=:id"),
                         {"id": aid}).first():
            raise HTTPException(404, "bank account not found")
        if set_default and new_default:
            _clear_default_accounts(c, exclude_id=aid)
        c.execute(text(f"""
            UPDATE platform_bank_accounts
               SET {set_clauses}, updated_at=NOW()
             WHERE id=:__id__
        """), fields)
        row = c.execute(text("""
            SELECT id, bank_code, bank_name, account_no, account_name,
                   branch, short_name, qr_url, is_active, is_default,
                   feature_visible, sort_order, created_at, updated_at
              FROM platform_bank_accounts WHERE id=:id
        """), {"id": aid}).mappings().first()

    return {"ok": True, "id": aid, "account": _account_row(row)}


@router.delete("/bank-accounts/{aid}")
def delete_bank_account(aid: str, authorization: str = Header(None)):
    _admin_auth(authorization)
    with engine.begin() as c:
        if not c.execute(text("SELECT 1 FROM platform_bank_accounts WHERE id=:id"),
                         {"id": aid}).first():
            raise HTTPException(404, "bank account not found")
        c.execute(text("DELETE FROM platform_bank_accounts WHERE id=:id"), {"id": aid})
    return {"ok": True, "id": aid, "deleted": True}


@router.post("/bank-accounts/{aid}/upload-qr")
async def upload_bank_qr(aid: str, file: UploadFile = File(...),
                          authorization: str = Header(None)):
    _admin_auth(authorization)

    with engine.connect() as c:
        if not c.execute(text("SELECT 1 FROM platform_bank_accounts WHERE id=:id"),
                         {"id": aid}).first():
            raise HTTPException(404, "bank account not found")

    ext = os.path.splitext(file.filename or "qr.jpg")[1].lower() or ".jpg"
    if ext not in ALLOWED_QR_EXT:
        raise HTTPException(400, f"file ext must be {sorted(ALLOWED_QR_EXT)}")

    # read in chunks + size check
    fname = f"{aid}_{int(time.time())}{ext}"
    fpath = os.path.join(UPLOAD_DIR, fname)
    size = 0
    with open(fpath, "wb") as out:
        while True:
            chunk = await file.read(64 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_QR_BYTES:
                out.close()
                try:
                    os.remove(fpath)
                except Exception:
                    pass
                raise HTTPException(400, "file too large (max 2MB)")
            out.write(chunk)

    url = f"{UPLOAD_URL_PREFIX}/{fname}"
    with engine.begin() as c:
        c.execute(text("""
            UPDATE platform_bank_accounts
               SET qr_url=:url, updated_at=NOW()
             WHERE id=:id
        """), {"url": url, "id": aid})

    return {"ok": True, "id": aid, "qr_url": url, "bytes": size}


# ═══════════════════════ PHASE 2 — PAYMENT GATEWAYS ═══════════════════════

@router.get("/payment-gateways")
def list_gateways(authorization: str = Header(None)):
    _admin_auth(authorization)
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT id, provider_code, provider_name, api_endpoint,
                   api_key_public, api_key_secret, webhook_url,
                   is_active, feature_visible, config_jsonb,
                   created_at, updated_at
              FROM platform_payment_gateways
             ORDER BY created_at DESC
        """)).mappings().all()
    return {"gateways": [_gateway_row(r) for r in rows]}


def _parse_config(value) -> dict:
    if value in (None, ""):
        return {}
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            raise HTTPException(400, "config_jsonb must be valid JSON object")
        if not isinstance(parsed, dict):
            raise HTTPException(400, "config_jsonb must be JSON object")
        return parsed
    raise HTTPException(400, "config_jsonb must be JSON object or string")


@router.post("/payment-gateways")
def create_gateway(payload: dict, authorization: str = Header(None)):
    _admin_auth(authorization)
    p = payload or {}
    provider_code = (p.get("provider_code") or "").strip().lower()
    provider_name = (p.get("provider_name") or "").strip()
    if not provider_code:
        raise HTTPException(400, "provider_code required")
    if not provider_name:
        raise HTTPException(400, "provider_name required")

    fields = {
        "provider_code":   provider_code,
        "provider_name":   provider_name,
        "api_endpoint":    (p.get("api_endpoint") or "").strip() or None,
        "api_key_public":  (p.get("api_key_public") or "").strip() or None,
        "api_key_secret":  (p.get("api_key_secret") or "").strip() or None,
        "webhook_url":     (p.get("webhook_url") or "").strip() or None,
        "is_active":       _bool(p.get("is_active"), False),
        "feature_visible": _bool(p.get("feature_visible"), False),
        "config_jsonb":    json.dumps(_parse_config(p.get("config_jsonb"))),
    }

    with engine.begin() as c:
        new_id = c.execute(text("""
            INSERT INTO platform_payment_gateways
                (provider_code, provider_name, api_endpoint,
                 api_key_public, api_key_secret, webhook_url,
                 is_active, feature_visible, config_jsonb)
            VALUES
                (:provider_code, :provider_name, :api_endpoint,
                 :api_key_public, :api_key_secret, :webhook_url,
                 :is_active, :feature_visible, CAST(:config_jsonb AS jsonb))
            RETURNING id
        """), fields).scalar()
        row = c.execute(text("""
            SELECT id, provider_code, provider_name, api_endpoint,
                   api_key_public, api_key_secret, webhook_url,
                   is_active, feature_visible, config_jsonb,
                   created_at, updated_at
              FROM platform_payment_gateways WHERE id=:id
        """), {"id": new_id}).mappings().first()

    return {"ok": True, "id": new_id, "gateway": _gateway_row(row)}


@router.put("/payment-gateways/{gid}")
def update_gateway(gid: str, payload: dict, authorization: str = Header(None)):
    _admin_auth(authorization)
    p = payload or {}

    fields = {}
    if "provider_code" in p:
        v = (p["provider_code"] or "").strip().lower()
        if not v:
            raise HTTPException(400, "provider_code cannot be empty")
        fields["provider_code"] = v
    if "provider_name" in p:
        v = (p["provider_name"] or "").strip()
        if not v:
            raise HTTPException(400, "provider_name cannot be empty")
        fields["provider_name"] = v
    for k in ("api_endpoint", "api_key_public", "api_key_secret", "webhook_url"):
        if k in p:
            v = (p[k] or "").strip()
            fields[k] = v if v else None
    if "is_active" in p:
        fields["is_active"] = _bool(p["is_active"], False)
    if "feature_visible" in p:
        fields["feature_visible"] = _bool(p["feature_visible"], False)
    if "config_jsonb" in p:
        fields["config_jsonb"] = json.dumps(_parse_config(p["config_jsonb"]))

    if not fields:
        raise HTTPException(400, "no editable fields")

    set_parts = []
    for k in fields.keys():
        if k == "config_jsonb":
            set_parts.append(f"{k}=CAST(:{k} AS jsonb)")
        else:
            set_parts.append(f"{k}=:{k}")
    set_sql = ", ".join(set_parts)

    params = {**fields, "id": gid}

    with engine.begin() as c:
        if not c.execute(text("SELECT 1 FROM platform_payment_gateways WHERE id=:id"),
                         {"id": gid}).first():
            raise HTTPException(404, "gateway not found")
        c.execute(text(f"""
            UPDATE platform_payment_gateways
               SET {set_sql}, updated_at=NOW()
             WHERE id=:id
        """), params)
        row = c.execute(text("""
            SELECT id, provider_code, provider_name, api_endpoint,
                   api_key_public, api_key_secret, webhook_url,
                   is_active, feature_visible, config_jsonb,
                   created_at, updated_at
              FROM platform_payment_gateways WHERE id=:id
        """), {"id": gid}).mappings().first()

    return {"ok": True, "id": gid, "gateway": _gateway_row(row)}


@router.delete("/payment-gateways/{gid}")
def delete_gateway(gid: str, authorization: str = Header(None)):
    _admin_auth(authorization)
    with engine.begin() as c:
        if not c.execute(text("SELECT 1 FROM platform_payment_gateways WHERE id=:id"),
                         {"id": gid}).first():
            raise HTTPException(404, "gateway not found")
        c.execute(text("DELETE FROM platform_payment_gateways WHERE id=:id"), {"id": gid})
    return {"ok": True, "id": gid, "deleted": True}


# ═══════════════════════ PHASE 3 — BANK APIs ═══════════════════════

@router.get("/bank-apis")
def list_bank_apis(authorization: str = Header(None)):
    _admin_auth(authorization)
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT id, bank_code, api_endpoint, client_id, client_secret,
                   is_active, feature_visible, config_jsonb,
                   last_check_at, last_check_status,
                   created_at, updated_at
              FROM platform_bank_apis
             ORDER BY created_at DESC
        """)).mappings().all()
    return {"apis": [_bankapi_row(r) for r in rows]}


@router.post("/bank-apis")
def create_bank_api(payload: dict, authorization: str = Header(None)):
    _admin_auth(authorization)
    p = payload or {}
    bank_code = _validate_bank_code(p.get("bank_code"))

    fields = {
        "bank_code":       bank_code,
        "api_endpoint":    (p.get("api_endpoint") or "").strip() or None,
        "client_id":       (p.get("client_id") or "").strip() or None,
        "client_secret":   (p.get("client_secret") or "").strip() or None,
        "is_active":       _bool(p.get("is_active"), False),
        "feature_visible": _bool(p.get("feature_visible"), False),
        "config_jsonb":    json.dumps(_parse_config(p.get("config_jsonb"))),
    }

    with engine.begin() as c:
        new_id = c.execute(text("""
            INSERT INTO platform_bank_apis
                (bank_code, api_endpoint, client_id, client_secret,
                 is_active, feature_visible, config_jsonb)
            VALUES
                (:bank_code, :api_endpoint, :client_id, :client_secret,
                 :is_active, :feature_visible, CAST(:config_jsonb AS jsonb))
            RETURNING id
        """), fields).scalar()
        row = c.execute(text("""
            SELECT id, bank_code, api_endpoint, client_id, client_secret,
                   is_active, feature_visible, config_jsonb,
                   last_check_at, last_check_status,
                   created_at, updated_at
              FROM platform_bank_apis WHERE id=:id
        """), {"id": new_id}).mappings().first()

    return {"ok": True, "id": new_id, "api": _bankapi_row(row)}


@router.put("/bank-apis/{bid}")
def update_bank_api(bid: str, payload: dict, authorization: str = Header(None)):
    _admin_auth(authorization)
    p = payload or {}

    fields = {}
    if "bank_code" in p:
        fields["bank_code"] = _validate_bank_code(p["bank_code"])
    for k in ("api_endpoint", "client_id", "client_secret"):
        if k in p:
            v = (p[k] or "").strip()
            fields[k] = v if v else None
    if "is_active" in p:
        fields["is_active"] = _bool(p["is_active"], False)
    if "feature_visible" in p:
        fields["feature_visible"] = _bool(p["feature_visible"], False)
    if "config_jsonb" in p:
        fields["config_jsonb"] = json.dumps(_parse_config(p["config_jsonb"]))

    if not fields:
        raise HTTPException(400, "no editable fields")

    set_parts = []
    for k in fields.keys():
        if k == "config_jsonb":
            set_parts.append(f"{k}=CAST(:{k} AS jsonb)")
        else:
            set_parts.append(f"{k}=:{k}")
    set_sql = ", ".join(set_parts)
    params = {**fields, "id": bid}

    with engine.begin() as c:
        if not c.execute(text("SELECT 1 FROM platform_bank_apis WHERE id=:id"),
                         {"id": bid}).first():
            raise HTTPException(404, "bank api not found")
        c.execute(text(f"""
            UPDATE platform_bank_apis
               SET {set_sql}, updated_at=NOW()
             WHERE id=:id
        """), params)
        row = c.execute(text("""
            SELECT id, bank_code, api_endpoint, client_id, client_secret,
                   is_active, feature_visible, config_jsonb,
                   last_check_at, last_check_status,
                   created_at, updated_at
              FROM platform_bank_apis WHERE id=:id
        """), {"id": bid}).mappings().first()

    return {"ok": True, "id": bid, "api": _bankapi_row(row)}


@router.delete("/bank-apis/{bid}")
def delete_bank_api(bid: str, authorization: str = Header(None)):
    _admin_auth(authorization)
    with engine.begin() as c:
        if not c.execute(text("SELECT 1 FROM platform_bank_apis WHERE id=:id"),
                         {"id": bid}).first():
            raise HTTPException(404, "bank api not found")
        c.execute(text("DELETE FROM platform_bank_apis WHERE id=:id"), {"id": bid})
    return {"ok": True, "id": bid, "deleted": True}


@router.post("/bank-apis/{bid}/test-connection")
def test_bank_api_connection(bid: str, authorization: str = Header(None)):
    """Stub test endpoint — Phase 3 จริงต่อ API ตาม bank_code spec ทีหลัง.
    ตอนนี้ตรวจแค่ว่า config มีฟิลด์ครบแล้ว update last_check fields"""
    _admin_auth(authorization)
    with engine.begin() as c:
        row = c.execute(text("""
            SELECT id, bank_code, api_endpoint, client_id, client_secret
              FROM platform_bank_apis WHERE id=:id
        """), {"id": bid}).mappings().first()
        if not row:
            raise HTTPException(404, "bank api not found")

        missing = []
        for k in ("api_endpoint", "client_id", "client_secret"):
            if not row[k]:
                missing.append(k)
        status = "ok" if not missing else "config_incomplete"
        message = "ok" if not missing else f"missing: {', '.join(missing)}"

        c.execute(text("""
            UPDATE platform_bank_apis
               SET last_check_at=NOW(),
                   last_check_status=:s,
                   updated_at=NOW()
             WHERE id=:id
        """), {"s": status, "id": bid})

    return {
        "ok": status == "ok",
        "id": bid,
        "bank_code": row["bank_code"],
        "status": status,
        "message": message,
    }
