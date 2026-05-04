import os, json, jwt
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import text
from app.core.db import engine

router = APIRouter(prefix="/api/tenant", tags=["tenant-settings"])
JWT_SECRET = os.getenv("JWT_SECRET", "")


PERSONAS = [
    {"id": "friendly-female",     "label": "ผู้หญิง · เป็นมิตร"},
    {"id": "professional-female", "label": "ผู้หญิง · สุภาพ"},
    {"id": "cute-female",         "label": "ผู้หญิง · น่ารัก"},
    {"id": "friendly-male",       "label": "ผู้ชาย · เป็นมิตร"},
    {"id": "professional-male",   "label": "ผู้ชาย · สุภาพ"},
    {"id": "casual-male",         "label": "ผู้ชาย · เท่"},
]
PERSONA_IDS = {p["id"] for p in PERSONAS}


BIZ_TYPES = {
    "อาหาร & เครื่องดื่ม": {
        "ร้านอาหาร": ["อาหารตามสั่ง","อาหารอีสาน","อาหารญี่ปุ่น","อาหารจีน","อาหารฝรั่ง","ก๋วยเตี๋ยว","ส้มตำ","อื่นๆ"],
        "คาเฟ่ & ขนม": ["กาแฟ-ชา","เบเกอรี่","ของหวาน-ไอศกรีม","อื่นๆ"],
        "เครื่องดื่ม": ["น้ำผลไม้","ชานมไข่มุก","สมูทตี้","เครื่องดื่มชง","อื่นๆ"],
        "Street Food": ["ปิ้งย่าง","ทอด","ต้ม","อื่นๆ"],
    },
    "แฟชั่น & ความงาม": {
        "เสื้อผ้า": ["ผู้หญิง","ผู้ชาย","เด็ก","ครอบครัว","แบรนด์เนม","อื่นๆ"],
        "เครื่องประดับ": ["เงิน-ทอง","แฟชั่น","นาฬิกา","อื่นๆ"],
        "ความงาม": ["เครื่องสำอาง","สกินแคร์","น้ำหอม","อาหารเสริม","อื่นๆ"],
        "รองเท้า-กระเป๋า": ["รองเท้า","กระเป๋า","อื่นๆ"],
    },
    "บ้าน & ของใช้": {
        "เฟอร์นิเจอร์": ["ห้องนอน","ห้องนั่งเล่น","ครัว","สวน","อื่นๆ"],
        "ของแต่งบ้าน": ["โคมไฟ","ผ้าม่าน","ภาพ-กระจก","อื่นๆ"],
        "ของใช้ในบ้าน": ["เครื่องครัว","ทำความสะอาด","อื่นๆ"],
        "DIY-ฮาร์ดแวร์": ["เครื่องมือ","สี","อื่นๆ"],
    },
    "สุขภาพ & ฟิตเนส": {
        "อาหารเสริม": ["วิตามิน","โปรตีน","ลดน้ำหนัก","อื่นๆ"],
        "อุปกรณ์ออกกำลังกาย": ["ฟิตเนส","กีฬา","โยคะ","อื่นๆ"],
        "ผลิตภัณฑ์สุขภาพ": ["สมุนไพร","ออร์แกนิก","อื่นๆ"],
    },
    "อิเล็กทรอนิกส์ & IT": {
        "มือถือ-อุปกรณ์": ["มือถือใหม่","มือถือมือสอง","accessories","อื่นๆ"],
        "คอมพิวเตอร์": ["โน๊ตบุ๊ค","PC","accessories","อื่นๆ"],
        "เครื่องใช้ไฟฟ้า": ["ครัวเรือน","Smart Home","อื่นๆ"],
        "Gaming": ["เกม","อุปกรณ์เกม","อื่นๆ"],
    },
    "บริการ": {
        "ความงาม-สปา": ["ทำผม","นวด-สปา","ทำเล็บ","อื่นๆ"],
        "ซ่อม-บำรุง": ["รถยนต์","มอเตอร์ไซค์","เครื่องใช้ไฟฟ้า","อื่นๆ"],
        "การศึกษา": ["ติวเตอร์","สอนพิเศษ","คอร์สออนไลน์","อื่นๆ"],
        "อื่นๆ": ["รับจ้างทั่วไป","ที่ปรึกษา","อื่นๆ"],
    },
    "เกษตร & อาหารสด": {
        "ผัก-ผลไม้": ["ออร์แกนิก","ตลาด","อื่นๆ"],
        "เนื้อสัตว์-อาหารทะเล": ["หมู-ไก่","อาหารทะเล","อื่นๆ"],
        "ของแห้ง": ["ข้าว","เครื่องเทศ","อื่นๆ"],
    },
    "อื่นๆ": {
        "อื่นๆ": ["อื่นๆ"],
    },
}


def _decode(authorization: str):
    try:
        token = (authorization or "").replace("Bearer ", "").strip()
        if not token:
            raise HTTPException(401, "missing token")
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"],
                          options={"leeway": 864000, "verify_exp": False})
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(401, "invalid token")


def _resolve_tenant(payload: dict) -> str:
    tid = payload.get("tenant_id")
    if tid:
        return tid
    sub = payload.get("sub")
    if sub:
        with engine.connect() as c:
            r = c.execute(text("SELECT tenant_id FROM tenant_staff WHERE id=:id LIMIT 1"),
                          {"id": sub}).fetchone()
            if r and r[0]:
                return r[0]
            email = payload.get("email")
            if email:
                r = c.execute(text("SELECT id FROM tenants WHERE email=:e LIMIT 1"),
                              {"e": email}).fetchone()
                if r:
                    return r[0]
    raise HTTPException(401, "no tenant for token")


def _get_ctx(authorization: str):
    payload = _decode(authorization)
    tid = _resolve_tenant(payload)
    role = (payload.get("role") or "").lower()
    return tid, role, payload


@router.get("/personas")
def list_personas():
    return PERSONAS


@router.get("/biz-types")
def list_biz_types():
    return BIZ_TYPES


@router.get("/settings")
def get_settings(authorization: str = Header("")):
    tid, role, _ = _get_ctx(authorization)
    with engine.connect() as c:
        t = c.execute(text("""
            SELECT id, subdomain, store_name, logo_url, bio,
                   ai_persona, ai_context,
                   biz_type_l1, biz_type_l2, biz_type_l3, biz_custom,
                   package_id, trial_ends_at, subscription_ends_at, billing_status
            FROM tenants WHERE id=:tid LIMIT 1
        """), {"tid": tid}).fetchone()
        if not t:
            raise HTTPException(404, "tenant not found")
        m = dict(t._mapping)

        ss = c.execute(text("""
            SELECT store_name, logo_url FROM store_settings WHERE tenant_id=:tid LIMIT 1
        """), {"tid": tid}).fetchone()
        ss_store_name = ss[0] if ss else None
        ss_logo_url = ss[1] if ss else None

        pkg = None
        if m.get("package_id"):
            pr = c.execute(text("""
                SELECT id, COALESCE(label, name) AS name FROM packages WHERE id=:pid LIMIT 1
            """), {"pid": m["package_id"]}).fetchone()
            if pr:
                pkg = {"id": pr[0], "name": pr[1]}

        cr = c.execute(text("""
            SELECT credit_total, credit_used FROM ai_tenant_credits WHERE tenant_id=:tid LIMIT 1
        """), {"tid": tid}).fetchone()
        credit_total = int(cr[0]) if cr and cr[0] is not None else 0
        credit_used = int(cr[1]) if cr and cr[1] is not None else 0

    ctx = m.get("ai_context") or {}
    if isinstance(ctx, str):
        try:
            ctx = json.loads(ctx)
        except Exception:
            ctx = {}
    ai_constraints = ctx.get("constraints", "") if isinstance(ctx, dict) else ""

    return {
        "tenant_id": m["id"],
        "subdomain": m.get("subdomain") or "",
        "store_name": ss_store_name or m.get("store_name") or "",
        "logo_url": ss_logo_url or m.get("logo_url") or "",
        "bio": m.get("bio") or "",
        "package": {
            "id": (pkg or {}).get("id", m.get("package_id") or ""),
            "name": (pkg or {}).get("name", ""),
            "trial_ends_at": m.get("trial_ends_at").isoformat() if m.get("trial_ends_at") else None,
            "subscription_ends_at": m.get("subscription_ends_at").isoformat() if m.get("subscription_ends_at") else None,
            "billing_status": m.get("billing_status") or "",
        },
        "credit": {
            "total": credit_total,
            "used": credit_used,
            "remaining": max(credit_total - credit_used, 0),
        },
        "ai": {
            "persona": m.get("ai_persona") or "friendly-female",
            "constraints": ai_constraints,
        },
        "biz_type": {
            "l1": m.get("biz_type_l1") or "",
            "l2": m.get("biz_type_l2") or "",
            "l3": m.get("biz_type_l3") or "",
            "custom": m.get("biz_custom") or None,
        },
        "permissions": {"can_edit": role == "owner"},
    }


class SettingsIn(BaseModel):
    ai_persona: Optional[str] = None
    ai_constraints: Optional[str] = None
    bio: Optional[str] = None
    biz_type_l1: Optional[str] = None
    biz_type_l2: Optional[str] = None
    biz_type_l3: Optional[str] = None
    biz_custom: Optional[str] = None


@router.put("/settings")
def put_settings(payload: SettingsIn, authorization: str = Header("")):
    tid, role, _ = _get_ctx(authorization)
    if role != "owner":
        raise HTTPException(403, {"error": "only_owner",
                                  "message": "เฉพาะเจ้าของร้านแก้ไขได้"})

    if payload.ai_persona is not None and payload.ai_persona not in PERSONA_IDS:
        raise HTTPException(400, f"invalid persona: {payload.ai_persona}")

    with engine.begin() as c:
        if payload.ai_persona is not None:
            c.execute(text("UPDATE tenants SET ai_persona=:v WHERE id=:tid"),
                      {"v": payload.ai_persona, "tid": tid})

        if payload.ai_constraints is not None:
            c.execute(text("""
                UPDATE tenants
                SET ai_context = jsonb_set(
                    COALESCE(ai_context, '{}'::jsonb),
                    '{constraints}',
                    to_jsonb(CAST(:v AS text))
                )
                WHERE id = :tid
            """), {"v": payload.ai_constraints, "tid": tid})

        if payload.bio is not None:
            c.execute(text("UPDATE tenants SET bio=:v WHERE id=:tid"),
                      {"v": payload.bio, "tid": tid})

        for col, val in (
            ("biz_type_l1", payload.biz_type_l1),
            ("biz_type_l2", payload.biz_type_l2),
            ("biz_type_l3", payload.biz_type_l3),
            ("biz_custom",  payload.biz_custom),
        ):
            if val is not None:
                c.execute(text(f"UPDATE tenants SET {col}=:v WHERE id=:tid"),
                          {"v": val, "tid": tid})

    return {"ok": True}
