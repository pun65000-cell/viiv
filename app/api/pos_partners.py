import os, uuid
import jwt
from fastapi import APIRouter, Header, HTTPException, UploadFile, File
from sqlalchemy import text
from app.core.db import engine
from app.middleware.gateway import require_quota

router = APIRouter(prefix="/api/pos/partners", tags=["pos-partners"])
JWT_SECRET = os.getenv("JWT_SECRET", "")

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

def gen_id():
    import time, random, string
    return "ptr_" + str(int(time.time())) + "_" + "".join(random.choices(string.ascii_lowercase+string.digits, k=4))

def gen_partner_code(tid, engine):
    import random, string
    with engine.connect() as c:
        for _ in range(20):
            code = "P" + "".join(random.choices(string.digits, k=5))
            ex = c.execute(text("SELECT 1 FROM partners WHERE tenant_id=:tid AND partner_code=:code"),{"tid":tid,"code":code}).fetchone()
            if not ex: return code
    return "P" + str(int(__import__("time").time()))[-5:]

@router.get("/check-code")
def check_code(code: str, pid: str = "", authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.connect() as c:
        q = "SELECT id FROM partners WHERE tenant_id=:tid AND partner_code=:code"
        params = {"tid":tid,"code":code}
        row = c.execute(text(q),params).fetchone()
        if row and row[0] != pid:
            return {"available": False, "message": "รหัสนี้ถูกใช้แล้ว"}
        return {"available": True}

@router.get("/list")
def list_partners(authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.connect() as c:
        rows = c.execute(text("SELECT * FROM partners WHERE tenant_id=:tid ORDER BY created_at DESC"),{"tid":tid}).fetchall()
        return [dict(r._mapping) for r in rows]

@router.post("/create")
@require_quota("max_members")
def create_partner(payload: dict, authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    pid = gen_id()
    with engine.begin() as c:
        c.execute(text("""INSERT INTO partners(
            id,tenant_id,partner_code,entity_type,company_name,tax_id,partner_type,social_url,
            phone,address,subdistrict,district,province,postal_code,country,
            contact_name,contact_position,contact_phone,contact_line,contact_email,
            credit_limit,credit_term,discount,bank,bank_account,bank_account_name,
            note,avatar_url,created_at,updated_at)
            VALUES(:id,:tid,:pc,:et,:cn,:ti,:pt,:su,:ph,:ad,:sb,:di,:pv,:pcode,:co,
            :ctn,:ctp,:cph,:cln,:cem,:cl,:ctm,:dc,:bk,:ba,:bn,:nt,:av,NOW(),NOW())"""),
            {"id":pid,"tid":tid,"pc":payload.get("partner_code","") or gen_partner_code(tid,engine),
             "et":payload.get("entity_type","company"),
             "cn":payload.get("company_name",""),"ti":payload.get("tax_id",""),
             "pt":payload.get("partner_type","supplier"),"su":payload.get("social_url",""),
             "ph":payload.get("phone",""),"ad":payload.get("address",""),
             "sb":payload.get("subdistrict",""),"di":payload.get("district",""),
             "pv":payload.get("province",""),"pcode":payload.get("postal_code",""),
             "co":payload.get("country","ไทย"),
             "ctn":payload.get("contact_name",""),"ctp":payload.get("contact_position",""),
             "cph":payload.get("contact_phone",""),"cln":payload.get("contact_line",""),
             "cem":payload.get("contact_email",""),
             "cl":float(payload.get("credit_limit",0)),"ctm":int(payload.get("credit_term",30)),
             "dc":float(payload.get("discount",0)),"bk":payload.get("bank",""),
             "ba":payload.get("bank_account",""),"bn":payload.get("bank_account_name",""),
             "nt":payload.get("note",""),"av":payload.get("avatar_url","")})
    return {"id":pid,"company_name":payload.get("company_name",""),"partner_code":payload.get("partner_code","") or gen_partner_code(tid,engine),"phone":payload.get("phone",""),"message":"success"}

@router.put("/update/{pid}")
def update_partner(pid: str, payload: dict, authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.begin() as c:
        c.execute(text("""UPDATE partners SET
            partner_code=CASE WHEN :pc!='' THEN :pc ELSE partner_code END,entity_type=:et,company_name=:cn,tax_id=:ti,partner_type=:pt,social_url=:su,
            phone=:ph,address=:ad,subdistrict=:sb,district=:di,province=:pv,
            postal_code=:pc,country=:co,contact_name=:ctn,contact_position=:ctp,
            contact_phone=:cph,contact_line=:cln,contact_email=:cem,
            credit_limit=:cl,credit_term=:ctm,discount=:dc,bank=:bk,
            bank_account=:ba,bank_account_name=:bn,note=:nt,avatar_url=:av,updated_at=NOW()
            WHERE id=:pid AND tenant_id=:tid"""),
            {"pid":pid,"tid":tid,"pc":payload.get("partner_code",""),
             "et":payload.get("entity_type","company"),
             "cn":payload.get("company_name",""),"ti":payload.get("tax_id",""),
             "pt":payload.get("partner_type","supplier"),"su":payload.get("social_url",""),
             "ph":payload.get("phone",""),"ad":payload.get("address",""),
             "sb":payload.get("subdistrict",""),"di":payload.get("district",""),
             "pv":payload.get("province",""),"pcode":payload.get("postal_code",""),
             "co":payload.get("country","ไทย"),
             "ctn":payload.get("contact_name",""),"ctp":payload.get("contact_position",""),
             "cph":payload.get("contact_phone",""),"cln":payload.get("contact_line",""),
             "cem":payload.get("contact_email",""),
             "cl":float(payload.get("credit_limit",0)),"ctm":int(payload.get("credit_term",30)),
             "dc":float(payload.get("discount",0)),"bk":payload.get("bank",""),
             "ba":payload.get("bank_account",""),"bn":payload.get("bank_account_name",""),
             "nt":payload.get("note",""),"av":payload.get("avatar_url","")})
    return {"message":"updated"}

@router.delete("/delete/{pid}")
def delete_partner(pid: str, authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.begin() as c:
        c.execute(text("DELETE FROM partners WHERE id=:pid AND tenant_id=:tid"),{"pid":pid,"tid":tid})
    return {"message":"deleted"}

@router.post("/upload-doc/{pid}")
async def upload_doc(pid: str, file: UploadFile = File(...), authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    content = await file.read()
    if len(content) > 10*1024*1024: raise HTTPException(400,"File too large")
    ext = os.path.splitext(file.filename)[1].lower()
    doc_dir = f"/home/viivadmin/viiv/uploads/partners/{tid}"
    os.makedirs(doc_dir, exist_ok=True)
    fname = str(uuid.uuid4())+ext
    with open(os.path.join(doc_dir,fname),"wb") as f: f.write(content)
    url = f"/uploads/partners/{tid}/{fname}"
    with engine.begin() as c:
        c.execute(text("INSERT INTO partner_docs(id,partner_id,tenant_id,file_url,file_name,created_at) VALUES(:id,:pid,:tid,:url,:name,NOW())"),
            {"id":"doc_"+str(uuid.uuid4())[:8],"pid":pid,"tid":tid,"url":url,"name":file.filename})
    return {"url":url,"name":file.filename}
