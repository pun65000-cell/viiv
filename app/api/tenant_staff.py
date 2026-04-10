from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy import text
from app.core.db import engine
from app.core.id_generator import generate_id
from passlib.context import CryptContext
import json, jwt, os

router = APIRouter(prefix="/api/staff", tags=["tenant-staff"])
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
JWT_SECRET = os.getenv("JWT_SECRET", "viiv_super_secret_jwt_key_2026_prod")

def get_tenant_id(authorization: str = Header(...)):
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        tid = payload.get("tenant_id") or payload.get("sub")
        if not tid:
            raise HTTPException(401, "ไม่พบ tenant_id ใน token")
        return tid
    except Exception:
        raise HTTPException(401, "Token ไม่ถูกต้อง")

@router.get("/list")
def list_staff(tenant_id: str = Depends(get_tenant_id)):
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT id, first_name, last_name, email, phone, role,
                   staff_code, line_id, facebook, note,
                   permissions, avatar_url, is_active, created_at
            FROM tenant_staff
            WHERE tenant_id = :tid AND is_active = TRUE
            ORDER BY created_at DESC
        """), {"tid": tenant_id}).fetchall()
    return [dict(r._mapping) for r in rows]

@router.post("/create")
def create_staff(payload: dict, tenant_id: str = Depends(get_tenant_id)):
    required = ["first_name","last_name","email","role","password"]
    for f in required:
        if not payload.get(f):
            raise HTTPException(400, f"กรุณากรอก {f}")

    # เช็ค email ซ้ำ
    with engine.connect() as c:
        exists = c.execute(text(
            "SELECT id FROM tenant_staff WHERE tenant_id=:tid AND email=:email"
        ), {"tid": tenant_id, "email": payload["email"]}).fetchone()
        if exists:
            raise HTTPException(400, "อีเมลนี้มีในระบบแล้ว")

    staff_id = generate_id("stf")
    hashed = pwd_ctx.hash(payload["password"])
    perms = payload.get("permissions", {})

    with engine.begin() as c:
        c.execute(text("""
            INSERT INTO tenant_staff
              (id, tenant_id, first_name, last_name, email, phone,
               role, staff_code, line_id, facebook, note,
               hashed_password, permissions, avatar_url)
            VALUES
              (:id, :tid, :fn, :ln, :email, :phone,
               :role, :code, :line, :fb, :note,
               :pw, :perms::jsonb, :avatar)
        """), {
            "id": staff_id, "tid": tenant_id,
            "fn": payload["first_name"], "ln": payload["last_name"],
            "email": payload["email"], "phone": payload.get("phone",""),
            "role": payload["role"], "code": payload.get("staff_code",""),
            "line": payload.get("line_id",""), "fb": payload.get("facebook",""),
            "note": payload.get("note",""), "pw": hashed,
            "perms": json.dumps(perms), "avatar": payload.get("avatar_url","")
        })
    return {"id": staff_id, "message": "สร้างพนักงานสำเร็จ"}

@router.put("/update/{staff_id}")
def update_staff(staff_id: str, payload: dict,
                 tenant_id: str = Depends(get_tenant_id)):
    with engine.begin() as c:
        result = c.execute(text("""
            UPDATE tenant_staff SET
              first_name=:fn, last_name=:ln, email=:email,
              phone=:phone, role=:role, staff_code=:code,
              line_id=:line, facebook=:fb, note=:note,
              permissions=:perms::jsonb, updated_at=NOW()
            WHERE id=:sid AND tenant_id=:tid
        """), {
            "fn": payload.get("first_name"), "ln": payload.get("last_name"),
            "email": payload.get("email"), "phone": payload.get("phone",""),
            "role": payload.get("role"), "code": payload.get("staff_code",""),
            "line": payload.get("line_id",""), "fb": payload.get("facebook",""),
            "note": payload.get("note",""),
            "perms": json.dumps(payload.get("permissions",{})),
            "sid": staff_id, "tid": tenant_id
        })
        if result.rowcount == 0:
            raise HTTPException(404, "ไม่พบพนักงาน")
    return {"message": "อัพเดทสำเร็จ"}

@router.delete("/delete/{staff_id}")
def delete_staff(staff_id: str, tenant_id: str = Depends(get_tenant_id)):
    with engine.begin() as c:
        c.execute(text("""
            UPDATE tenant_staff SET is_active=FALSE, updated_at=NOW()
            WHERE id=:sid AND tenant_id=:tid
        """), {"sid": staff_id, "tid": tenant_id})
    return {"message": "ลบพนักงานสำเร็จ"}
