from fastapi import APIRouter, Header, HTTPException, UploadFile, File
from sqlalchemy import text
from app.core.db import engine
import jwt, os, uuid

router = APIRouter(prefix="/api/pos/store", tags=["pos-store"])
JWT_SECRET = os.getenv("JWT_SECRET", "")
UPLOAD_DIR = "/home/viivadmin/viiv/uploads/store"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def get_tenant(authorization=""):
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
        if tid: return tid
    except: pass
    raise HTTPException(401,"Unauthorized")

@router.get("/settings")
def get_settings(authorization: str = Header("")):
    tid = get_tenant(authorization)
    with engine.connect() as c:
        r = c.execute(text("SELECT * FROM store_settings WHERE tenant_id=:tid"),{"tid":tid}).fetchone()
    if not r:
        return {"tenant_id":tid,"store_name":"","logo_url":"","tax_id":"","phone":"","address":"","road":"","subdistrict":"","district":"","province":"","postal_code":"","bill_prefix":"BILL","inv_prefix":"INV","bill_start_seq":1,"inv_start_seq":1,"bill_format":"BILL-YYYY-NNNNNN","show_tax_id":True,"show_address":True}
    return dict(r._mapping)

@router.post("/settings")
def save_settings(payload: dict, authorization: str = Header("")):
    tid = get_tenant(authorization)
    missing = [f for f in ["store_name","phone","address","province"] if not str(payload.get(f,"")).strip()]
    if missing: raise HTTPException(400, f"กรุณากรอก: {', '.join(missing)}")
    p = payload
    params = {"tid":tid,"sn":p.get("store_name",""),"logo":p.get("logo_url",""),"tax":p.get("tax_id",""),"phone":p.get("phone",""),"addr":p.get("address",""),"road":p.get("road",""),"sub":p.get("subdistrict",""),"dist":p.get("district",""),"prov":p.get("province",""),"post":p.get("postal_code",""),"bp":p.get("bill_prefix","BILL"),"ip":p.get("inv_prefix","INV"),"bs":int(p.get("bill_start_seq",1)),"is_":int(p.get("inv_start_seq",1)),"bf":p.get("bill_format","BILL-YYYY-NNNNNN"),"stax":bool(p.get("show_tax_id",True)),"saddr":bool(p.get("show_address",True))}
    with engine.begin() as c:
        ex = c.execute(text("SELECT 1 FROM store_settings WHERE tenant_id=:tid"),{"tid":tid}).fetchone()
        if ex:
            c.execute(text("UPDATE store_settings SET store_name=:sn,logo_url=:logo,tax_id=:tax,phone=:phone,address=:addr,road=:road,subdistrict=:sub,district=:dist,province=:prov,postal_code=:post,bill_prefix=:bp,inv_prefix=:ip,bill_start_seq=:bs,inv_start_seq=:is_,bill_format=:bf,show_tax_id=:stax,show_address=:saddr,updated_at=NOW() WHERE tenant_id=:tid"),params)
        else:
            c.execute(text("INSERT INTO store_settings(tenant_id,store_name,logo_url,tax_id,phone,address,road,subdistrict,district,province,postal_code,bill_prefix,inv_prefix,bill_start_seq,inv_start_seq,bill_format,show_tax_id,show_address) VALUES(:tid,:sn,:logo,:tax,:phone,:addr,:road,:sub,:dist,:prov,:post,:bp,:ip,:bs,:is_,:bf,:stax,:saddr)"),params)
    return {"message":"บันทึกสำเร็จ"}

@router.post("/upload-logo")
async def upload_logo(file: UploadFile = File(...), authorization: str = Header("")):
    tid = get_tenant(authorization)
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".jpg",".jpeg",".png",".webp"]: raise HTTPException(400,"รองรับเฉพาะ JPG/PNG/WEBP")
    content = await file.read()
    if len(content)>5*1024*1024: raise HTTPException(400,"ไฟล์ใหญ่เกิน 5MB")
    fname = str(uuid.uuid4())+ext
    with open(os.path.join(UPLOAD_DIR,fname),"wb") as f: f.write(content)
    url = f"/uploads/store/{fname}"
    with engine.begin() as c:
        ex = c.execute(text("SELECT 1 FROM store_settings WHERE tenant_id=:tid"),{"tid":tid}).fetchone()
        if ex: c.execute(text("UPDATE store_settings SET logo_url=:u,updated_at=NOW() WHERE tenant_id=:tid"),{"u":url,"tid":tid})
        else: c.execute(text("INSERT INTO store_settings(tenant_id,logo_url) VALUES(:tid,:u)"),{"tid":tid,"u":url})
    return {"url":url}
