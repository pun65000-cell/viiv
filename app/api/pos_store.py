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
    params = {"tid":tid,"sn":p.get("store_name",""),"logo":p.get("logo_url",""),"tax":p.get("tax_id",""),"phone":p.get("phone",""),"addr":p.get("address",""),"road":p.get("road",""),"sub":p.get("subdistrict",""),"dist":p.get("district",""),"prov":p.get("province",""),"post":p.get("postal_code",""),"bp":p.get("bill_prefix","BILL"),"ip":p.get("inv_prefix","INV"),"bs":int(p.get("bill_start_seq",1)),"is_":int(p.get("inv_start_seq",1)),"bf":p.get("bill_format","BILL-YYYY-NNNNNN"),"bc":str(p.get("branch_code","")),"stax":bool(p.get("show_tax_id",True)),"saddr":bool(p.get("show_address",True)),"sbir":bool(p.get("show_bank_in_receipt",False)),"sft":bool(p.get("show_footer_text",False)),"ftxt":str(p.get("footer_text","")),"scan":str(p.get("scan_mode","combine")),"vat":str(p.get("vat_mode","included")),"ses":bool(p.get("stock_empty_sell",True)),"cat":bool(p.get("catalog_online",True))}
    with engine.begin() as c:
        ex = c.execute(text("SELECT 1 FROM store_settings WHERE tenant_id=:tid"),{"tid":tid}).fetchone()
        if ex:
            c.execute(text("UPDATE store_settings SET store_name=:sn,logo_url=:logo,tax_id=:tax,phone=:phone,address=:addr,road=:road,subdistrict=:sub,district=:dist,province=:prov,postal_code=:post,bill_prefix=:bp,inv_prefix=:ip,bill_start_seq=:bs,inv_start_seq=:is_,bill_format=:bf,branch_code=:bc,show_tax_id=:stax,show_address=:saddr,show_bank_in_receipt=:sbir,show_footer_text=:sft,footer_text=:ftxt,scan_mode=:scan,vat_mode=:vat,stock_empty_sell=:ses,catalog_online=:cat,updated_at=NOW() WHERE tenant_id=:tid"),params)
        else:
            c.execute(text("INSERT INTO store_settings(tenant_id,store_name,logo_url,tax_id,phone,address,road,subdistrict,district,province,postal_code,bill_prefix,inv_prefix,bill_start_seq,inv_start_seq,bill_format,branch_code,show_tax_id,show_address,show_bank_in_receipt,show_footer_text,footer_text,scan_mode,vat_mode,stock_empty_sell,catalog_online) VALUES(:tid,:sn,:logo,:tax,:phone,:addr,:road,:sub,:dist,:prov,:post,:bp,:ip,:bs,:is_,:bf,:bc,:stax,:saddr,:sbir,:sft,:ftxt,:scan,:vat,:ses,:cat)"),params)
    return {"message":"บันทึกสำเร็จ"}

@router.post("/upload-qr")
async def upload_qr(file: UploadFile = File(...), authorization: str = Header("")):
    tid = verify(authorization)
    content = await file.read()
    if len(content) > 5*1024*1024: raise HTTPException(400, "File too large")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".jpg",".jpeg",".png",".webp"]: raise HTTPException(400, "Invalid type")
    fname = str(uuid.uuid4())+ext
    qr_dir = "/home/viivadmin/viiv/uploads/store/qr"
    os.makedirs(qr_dir, exist_ok=True)
    with open(os.path.join(qr_dir, fname),"wb") as f: f.write(content)
    return {"url": f"/uploads/store/qr/{fname}"}

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
