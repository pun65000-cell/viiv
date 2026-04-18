from fastapi import APIRouter, Header, HTTPException, Query
from sqlalchemy import text
from app.core.db import engine
from app.core.id_generator import generate_id
import jwt, os, json
from datetime import datetime

router = APIRouter(prefix="/api/pos/members", tags=["pos-members"])
JWT_SECRET = os.getenv("JWT_SECRET", "viiv_super_secret_jwt_key_2026_prod")

def get_tenant_user(authorization=""):
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"], options={"leeway":864000,"verify_exp":False})
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

def ensure_table(conn):
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS members (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            code TEXT,
            name TEXT NOT NULL,
            phone TEXT,
            tax_id TEXT,
            email TEXT,
            birthday TEXT,
            address TEXT,
            geo TEXT,
            pv_total NUMERIC(12,2) DEFAULT 0,
            cash NUMERIC(12,2) DEFAULT 0,
            credit NUMERIC(12,2) DEFAULT 0,
            credit_limit NUMERIC(12,2) DEFAULT 0,
            note TEXT,
            platforms JSONB DEFAULT '[]',
            avatar_url TEXT,
            created_by TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            deleted_at TIMESTAMPTZ DEFAULT NULL
        )
    """))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_members_tenant ON members(tenant_id) WHERE deleted_at IS NULL"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_members_search ON members USING gin(to_tsvector('simple', coalesce(name,'')||coalesce(phone,'')||coalesce(code,''))) WHERE deleted_at IS NULL"))

@router.get("/list")
def list_members(
    q: str = Query(""),
    platform: str = Query(""),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    authorization: str = Header("")
):
    tid, uid = get_tenant_user(authorization)
    offset = (page-1)*limit
    with engine.connect() as c:
        ensure_table(c)
        base = "FROM members WHERE tenant_id=:tid AND deleted_at IS NULL"
        params = {"tid":tid,"limit":limit,"offset":offset}
        if q:
            base += " AND (name ILIKE :q OR phone ILIKE :q OR code ILIKE :q)"
            params["q"] = f"%{q}%"
        if platform:
            base += " AND platforms @> :pf::jsonb"
            params["pf"] = json.dumps([platform])
        total = c.execute(text(f"SELECT COUNT(*) {base}"), params).scalar()
        rows = c.execute(text(f"SELECT id,code,name,phone,tax_id,email,birthday,address,geo,pv_total,cash,credit,credit_limit,note,platforms,avatar_url,created_at,updated_at {base} ORDER BY created_at DESC LIMIT :limit OFFSET :offset"), params).fetchall()
        keys = ["id","code","name","phone","tax_id","email","birthday","address","geo","pv_total","cash","credit","credit_limit","note","platforms","avatar_url","created_at","updated_at"]
        members = []
        for r in rows:
            m = dict(zip(keys,r))
            m["pv_total"] = float(m["pv_total"] or 0)
            m["cash"] = float(m["cash"] or 0)
            m["credit"] = float(m["credit"] or 0)
            m["credit_limit"] = float(m["credit_limit"] or 0)
            m["platforms"] = m["platforms"] if isinstance(m["platforms"],list) else json.loads(m["platforms"] or "[]")
            m["created_at"] = m["created_at"].isoformat() if m["created_at"] else ""
            m["updated_at"] = m["updated_at"].isoformat() if m["updated_at"] else ""
            members.append(m)
        return {"total":total,"page":page,"limit":limit,"pages":(total+limit-1)//limit,"members":members}

@router.post("/create")
def create_member(payload: dict, authorization: str = Header("")):
    tid, uid = get_tenant_user(authorization)
    name = (payload.get("name") or "").strip()
    if not name: raise HTTPException(400, "กรุณาระบุชื่อ")
    mid = generate_id("mem")
    code = payload.get("code") or ("C"+mid[-6:].upper())
    with engine.begin() as c:
        ensure_table(c)
        existing = c.execute(text("SELECT id FROM members WHERE tenant_id=:tid AND code=:code AND deleted_at IS NULL"),{"tid":tid,"code":code}).fetchone()
        if existing: code = "C"+mid[-8:].upper()
        c.execute(text("""INSERT INTO members(id,tenant_id,code,name,phone,tax_id,email,birthday,address,geo,pv_total,cash,credit,credit_limit,note,platforms,avatar_url,created_by,created_at,updated_at)
            VALUES(:id,:tid,:code,:name,:phone,:tax_id,:email,:birthday,:address,:geo,:pv,:cash,:credit,:cl,:note,:platforms,:avatar,:uid,NOW(),NOW())"""),
            {"id":mid,"tid":tid,"code":code,"name":name,
             "phone":payload.get("phone",""),"tax_id":payload.get("tax_id",""),
             "email":payload.get("email",""),"birthday":payload.get("birthday",""),
             "address":payload.get("address",""),"geo":payload.get("geo",""),
             "pv":float(payload.get("pv_total",0)),"cash":float(payload.get("cash",0)),
             "credit":float(payload.get("credit",0)),"cl":float(payload.get("credit_limit",0)),
             "note":payload.get("note",""),
             "platforms":json.dumps(payload.get("platforms",[])),
             "avatar":payload.get("avatar_url",""),"uid":uid})
    return {"ok":True,"id":mid,"code":code}

@router.put("/update/{mid}")
def update_member(mid: str, payload: dict, authorization: str = Header("")):
    tid, uid = get_tenant_user(authorization)
    with engine.begin() as c:
        ensure_table(c)
        existing = c.execute(text("SELECT id FROM members WHERE id=:id AND tenant_id=:tid AND deleted_at IS NULL"),{"id":mid,"tid":tid}).fetchone()
        if not existing: raise HTTPException(404, "ไม่พบสมาชิก")
        c.execute(text("""UPDATE members SET name=:name,phone=:phone,tax_id=:tax_id,email=:email,
            birthday=:birthday,address=:address,geo=:geo,pv_total=:pv,cash=:cash,
            credit=:credit,credit_limit=:cl,note=:note,platforms=:platforms,
            avatar_url=:avatar,updated_at=NOW() WHERE id=:id AND tenant_id=:tid"""),
            {"id":mid,"tid":tid,"name":payload.get("name",""),
             "phone":payload.get("phone",""),"tax_id":payload.get("tax_id",""),
             "email":payload.get("email",""),"birthday":payload.get("birthday",""),
             "address":payload.get("address",""),"geo":payload.get("geo",""),
             "pv":float(payload.get("pv_total",0)),"cash":float(payload.get("cash",0)),
             "credit":float(payload.get("credit",0)),"cl":float(payload.get("credit_limit",0)),
             "note":payload.get("note",""),
             "platforms":json.dumps(payload.get("platforms",[])),
             "avatar":payload.get("avatar_url","")})
    return {"ok":True}

@router.delete("/delete/{mid}")
def delete_member(mid: str, authorization: str = Header("")):
    tid, uid = get_tenant_user(authorization)
    with engine.begin() as c:
        ensure_table(c)
        c.execute(text("UPDATE members SET deleted_at=NOW() WHERE id=:id AND tenant_id=:tid"),{"id":mid,"tid":tid})
    return {"ok":True}

@router.get("/search")
def search_members(q: str = Query(""), authorization: str = Header("")):
    tid, uid = get_tenant_user(authorization)
    with engine.connect() as c:
        ensure_table(c)
        rows = c.execute(text("""SELECT id,code,name,phone,address,geo,credit,credit_limit
            FROM members WHERE tenant_id=:tid AND deleted_at IS NULL
            AND (name ILIKE :q OR phone ILIKE :q OR code ILIKE :q)
            ORDER BY name LIMIT 20"""),{"tid":tid,"q":f"%{q}%"}).fetchall()
        return [{"id":r[0],"code":r[1],"name":r[2],"phone":r[3],"address":r[4],"geo":r[5],"credit":float(r[6] or 0),"credit_limit":float(r[7] or 0)} for r in rows]
