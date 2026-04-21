# app/api/pos_bank.py
# Bank Accounts API

import os, json, random, string, time
import jwt
from fastapi import APIRouter, Header, HTTPException, UploadFile, File
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
                u = c.execute(text("SELECT email FROM users WHERE id=:uid LIMIT 1"),{"uid":uid}).fetchone()
                if u:
                    t = c.execute(text("SELECT id FROM tenants WHERE email=:e LIMIT 1"),{"e":u[0]}).fetchone()
                    if t: tid = t[0]
            if not tid and payload.get("role")=="admin":
                t = c.execute(text("SELECT id FROM tenants ORDER BY created_at LIMIT 1")).fetchone()
                if t: tid = t[0]
        if tid: return tid, uid or "unknown"
    except: pass
    raise HTTPException(401, "Unauthorized")

def _row_to_dict(r):
    return {
        "id": r[0], "tenant_id": r[1], "bank_name": r[2],
        "acc_type": r[3], "acc_name": r[4], "acc_no": r[5],
        "bank_shop_name": r[6], "bank_shop_id": r[7],
        "qr_url": r[8], "is_default": r[9], "sort_order": r[10],
        "created_at": r[11].isoformat() if r[11] else "",
    }

@router.get("/list")
def list_banks(authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT id,tenant_id,bank_name,acc_type,acc_name,acc_no,
                   bank_shop_name,bank_shop_id,qr_url,is_default,sort_order,created_at
            FROM bank_accounts WHERE tenant_id=:tid ORDER BY is_default DESC, sort_order, created_at
        """), {"tid":tid}).fetchall()
    return {"banks": [_row_to_dict(r) for r in rows]}

@router.post("/create")
def create_bank(payload: dict, authorization: str = Header("")):
    tid, uid = get_tenant_user(authorization)
    bank_name = (payload.get("bank_name") or "").strip()
    acc_name  = (payload.get("acc_name") or "").strip()
    acc_no    = (payload.get("acc_no") or "").strip()
    if not bank_name or not acc_name or not acc_no:
        raise HTTPException(400, "กรุณากรอกข้อมูลที่จำเป็น")
    with engine.begin() as c:
        count = c.execute(text("SELECT COUNT(*) FROM bank_accounts WHERE tenant_id=:tid"), {"tid":tid}).scalar()
        if count >= 3:
            raise HTTPException(400, "สร้างได้สูงสุด 3 บัญชี")
        is_default = payload.get("is_default", count == 0)
        if is_default:
            c.execute(text("UPDATE bank_accounts SET is_default=FALSE WHERE tenant_id=:tid"), {"tid":tid})
        bid = _new_id("bnk")
        c.execute(text("""
            INSERT INTO bank_accounts(id,tenant_id,bank_name,acc_type,acc_name,acc_no,
                bank_shop_name,bank_shop_id,qr_url,is_default,sort_order)
            VALUES(:id,:tid,:bn,:at,:an,:ano,:bsn,:bsi,:qr,:isd,:so)
        """), {
            "id":bid,"tid":tid,"bn":bank_name,
            "at":payload.get("acc_type","ออมทรัพย์"),
            "an":acc_name,"ano":acc_no,
            "bsn":payload.get("bank_shop_name",""),
            "bsi":payload.get("bank_shop_id",""),
            "qr":payload.get("qr_url",""),
            "isd":is_default,"so":int(count)
        })
    return {"id":bid,"message":"ok"}

@router.put("/update/{bid}")
def update_bank(bid: str, payload: dict, authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.begin() as c:
        row = c.execute(text("SELECT id FROM bank_accounts WHERE id=:id AND tenant_id=:tid"),{"id":bid,"tid":tid}).fetchone()
        if not row: raise HTTPException(404, "ไม่พบบัญชี")
        is_default = payload.get("is_default", False)
        if is_default:
            c.execute(text("UPDATE bank_accounts SET is_default=FALSE WHERE tenant_id=:tid"), {"tid":tid})
        c.execute(text("""
            UPDATE bank_accounts SET
                bank_name=:bn, acc_type=:at, acc_name=:an, acc_no=:ano,
                bank_shop_name=:bsn, bank_shop_id=:bsi, qr_url=:qr,
                is_default=:isd, updated_at=NOW()
            WHERE id=:id AND tenant_id=:tid
        """), {
            "bn":payload.get("bank_name",""),"at":payload.get("acc_type","ออมทรัพย์"),
            "an":payload.get("acc_name",""),"ano":payload.get("acc_no",""),
            "bsn":payload.get("bank_shop_name",""),"bsi":payload.get("bank_shop_id",""),
            "qr":payload.get("qr_url",""),"isd":is_default,
            "id":bid,"tid":tid
        })
    return {"message":"ok"}

@router.delete("/delete/{bid}")
def delete_bank(bid: str, authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.begin() as c:
        c.execute(text("DELETE FROM bank_accounts WHERE id=:id AND tenant_id=:tid"),{"id":bid,"tid":tid})
    return {"message":"ok"}

@router.post("/upload-qr/{bid}")
async def upload_qr(bid: str, file: UploadFile = File(...), authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    content = await file.read()
    ext = (file.filename or "qr.png").rsplit(".",1)[-1].lower()
    fname = f"qr_{tid}_{bid}.{ext}"
    qr_dir = "/home/viivadmin/viiv/uploads/store/qr"
    os.makedirs(qr_dir, exist_ok=True)
    with open(os.path.join(qr_dir, fname),"wb") as f: f.write(content)
    url = f"/uploads/store/qr/{fname}"
    with engine.begin() as c:
        c.execute(text("UPDATE bank_accounts SET qr_url=:url WHERE id=:id AND tenant_id=:tid"),
            {"url":url,"id":bid,"tid":tid})
    return {"url":url}

@router.post("/upload-qr-new")
async def upload_qr_new(file: UploadFile = File(...), authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    content = await file.read()
    ext = (file.filename or "qr.png").rsplit(".",1)[-1].lower()
    fname = f"qr_{tid}_new_{int(time.time())}.{ext}"
    qr_dir = "/home/viivadmin/viiv/uploads/store/qr"
    os.makedirs(qr_dir, exist_ok=True)
    with open(os.path.join(qr_dir, fname),"wb") as f: f.write(content)
    return {"url": f"/uploads/store/qr/{fname}"}
