import os, uuid
import jwt
from fastapi import APIRouter, Header, HTTPException, UploadFile, File
from sqlalchemy import text
from app.core.db import engine

router = APIRouter(prefix="/api/pos/partners", tags=["pos-partners"])
JWT_SECRET = os.getenv("JWT_SECRET", "")

def get_tenant_user(authorization=""):
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"], options={"leeway":864000,"verify_exp":False})
        uid = payload.get("sub"); tid = payload.get("tenant_id")
        with engine.connect() as c:
            if not tid:
                raise HTTPException(401)
        return tid, uid or ""
    except HTTPException:
        raise
    except:
        raise HTTPException(status_code=401)

def gen_id():
    import time, random, string
    return "ptr_" + str(int(time.time())) + "_" + "".join(random.choices(string.ascii_lowercase+string.digits, k=4))

@router.get("/list")
def list_partners(authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.connect() as c:
        rows = c.execute(text("SELECT * FROM partners WHERE tenant_id=:tid ORDER BY created_at DESC"),{"tid":tid}).fetchall()
        return [dict(r._mapping) for r in rows]

@router.post("/create")
def create_partner(payload: dict, authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    pid = gen_id()
    with engine.begin() as c:
        c.execute(text("""INSERT INTO partners(
            id,tenant_id,entity_type,company_name,tax_id,partner_type,social_url,
            phone,address,subdistrict,district,province,postal_code,country,
            contact_name,contact_position,contact_phone,contact_line,contact_email,
            credit_limit,credit_term,discount,bank,bank_account,bank_account_name,
            note,avatar_url,created_at,updated_at)
            VALUES(:id,:tid,:et,:cn,:ti,:pt,:su,:ph,:ad,:sb,:di,:pv,:pc,:co,
            :ctn,:ctp,:cph,:cln,:cem,:cl,:ctm,:dc,:bk,:ba,:bn,:nt,:av,NOW(),NOW())"""),
            {"id":pid,"tid":tid,
             "et":payload.get("entity_type","company"),
             "cn":payload.get("company_name",""),"ti":payload.get("tax_id",""),
             "pt":payload.get("partner_type","supplier"),"su":payload.get("social_url",""),
             "ph":payload.get("phone",""),"ad":payload.get("address",""),
             "sb":payload.get("subdistrict",""),"di":payload.get("district",""),
             "pv":payload.get("province",""),"pc":payload.get("postal_code",""),
             "co":payload.get("country","ไทย"),
             "ctn":payload.get("contact_name",""),"ctp":payload.get("contact_position",""),
             "cph":payload.get("contact_phone",""),"cln":payload.get("contact_line",""),
             "cem":payload.get("contact_email",""),
             "cl":float(payload.get("credit_limit",0)),"ctm":int(payload.get("credit_term",30)),
             "dc":float(payload.get("discount",0)),"bk":payload.get("bank",""),
             "ba":payload.get("bank_account",""),"bn":payload.get("bank_account_name",""),
             "nt":payload.get("note",""),"av":payload.get("avatar_url","")})
    return {"id":pid,"message":"success"}

@router.put("/update/{pid}")
def update_partner(pid: str, payload: dict, authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.begin() as c:
        c.execute(text("""UPDATE partners SET
            entity_type=:et,company_name=:cn,tax_id=:ti,partner_type=:pt,social_url=:su,
            phone=:ph,address=:ad,subdistrict=:sb,district=:di,province=:pv,
            postal_code=:pc,country=:co,contact_name=:ctn,contact_position=:ctp,
            contact_phone=:cph,contact_line=:cln,contact_email=:cem,
            credit_limit=:cl,credit_term=:ctm,discount=:dc,bank=:bk,
            bank_account=:ba,bank_account_name=:bn,note=:nt,avatar_url=:av,updated_at=NOW()
            WHERE id=:pid AND tenant_id=:tid"""),
            {"pid":pid,"tid":tid,
             "et":payload.get("entity_type","company"),
             "cn":payload.get("company_name",""),"ti":payload.get("tax_id",""),
             "pt":payload.get("partner_type","supplier"),"su":payload.get("social_url",""),
             "ph":payload.get("phone",""),"ad":payload.get("address",""),
             "sb":payload.get("subdistrict",""),"di":payload.get("district",""),
             "pv":payload.get("province",""),"pc":payload.get("postal_code",""),
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
