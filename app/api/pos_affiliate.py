from fastapi import APIRouter, Header, HTTPException, UploadFile, File
from sqlalchemy import text
from app.core.db import engine
from app.core.id_generator import generate_id
import jwt, os, uuid, json

router = APIRouter(prefix="/api/pos/affiliate", tags=["affiliate"])
JWT_SECRET = os.getenv("JWT_SECRET", "")
UPLOAD_DIR = "/home/viivadmin/viiv/uploads/affiliate"
os.makedirs(UPLOAD_DIR, exist_ok=True)

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
    raise HTTPException(401,"Unauthorized")

@router.get("/list")
def list_products(authorization: str = Header(""), status: str = ""):
    tid, _ = get_tenant_user(authorization)
    filters = "WHERE tenant_id=:tid"
    params = {"tid": tid}
    if status: filters += " AND status=:status"; params["status"] = status
    with engine.connect() as c:
        rows = c.execute(text(f"""
            SELECT id,title,description,aff_url,source,price,commission,commission_type,
                   images,videos,options,click_count,status,created_at,updated_at
            FROM affiliate_products {filters} ORDER BY created_at DESC
        """), params).fetchall()
    result = []
    for r in rows:
        d = dict(r._mapping)
        for f in ["images","videos","options"]:
            if isinstance(d[f], str):
                try: d[f] = json.loads(d[f])
                except: d[f] = []
        result.append(d)
    return result

@router.get("/stats")
def get_stats(authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.connect() as c:
        total = c.execute(text("SELECT COUNT(*) FROM affiliate_products WHERE tenant_id=:tid"),{"tid":tid}).scalar()
        active = c.execute(text("SELECT COUNT(*) FROM affiliate_products WHERE tenant_id=:tid AND status='active'"),{"tid":tid}).scalar()
        clicks = c.execute(text("SELECT COALESCE(SUM(click_count),0) FROM affiliate_products WHERE tenant_id=:tid"),{"tid":tid}).scalar()
        top = c.execute(text("SELECT id,title,click_count FROM affiliate_products WHERE tenant_id=:tid ORDER BY click_count DESC LIMIT 5"),{"tid":tid}).fetchall()
    return {"total":total,"active":active,"total_clicks":clicks,"top_products":[dict(r._mapping) for r in top]}

@router.post("/create")
def create_product(payload: dict, authorization: str = Header("")):
    tid, uid = get_tenant_user(authorization)
    if not payload.get("title"): raise HTTPException(400,"กรุณากรอกชื่อสินค้า")
    if not payload.get("aff_url"): raise HTTPException(400,"กรุณาใส่ลิ้งค์ affiliate")
    pid = generate_id("aff")
    with engine.begin() as c:
        c.execute(text("""
            INSERT INTO affiliate_products(id,tenant_id,title,description,aff_url,source,
              price,commission,commission_type,images,videos,options,status,created_by)
            VALUES(:id,:tid,:title,:desc,:url,:src,:price,:comm,:ctype,:imgs,:vids,:opts,:status,:uid)
        """),{
            "id":pid,"tid":tid,
            "title":payload.get("title",""),
            "desc":payload.get("description",""),
            "url":payload.get("aff_url",""),
            "src":payload.get("source",""),
            "price":float(payload.get("price",0)),
            "comm":float(payload.get("commission",0)),
            "ctype":payload.get("commission_type","percent"),
            "imgs":json.dumps(payload.get("images",[])),
            "vids":json.dumps(payload.get("videos",[])),
            "opts":json.dumps(payload.get("options",[])),
            "status":payload.get("status","active"),
            "uid":uid
        })
    return {"id":pid,"message":"สร้างสำเร็จ"}

@router.put("/update/{pid}")
def update_product(pid: str, payload: dict, authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.begin() as c:
        c.execute(text("""
            UPDATE affiliate_products SET
              title=:title,description=:desc,aff_url=:url,source=:src,
              price=:price,commission=:comm,commission_type=:ctype,
              images=:imgs,videos=:vids,options=:opts,
              status=:status,updated_at=NOW()
            WHERE id=:id AND tenant_id=:tid
        """),{
            "id":pid,"tid":tid,
            "title":payload.get("title",""),
            "desc":payload.get("description",""),
            "url":payload.get("aff_url",""),
            "src":payload.get("source",""),
            "price":float(payload.get("price",0)),
            "comm":float(payload.get("commission",0)),
            "ctype":payload.get("commission_type","percent"),
            "imgs":json.dumps(payload.get("images",[])),
            "vids":json.dumps(payload.get("videos",[])),
            "opts":json.dumps(payload.get("options",[])),
            "status":payload.get("status","active")
        })
    return {"message":"อัพเดทสำเร็จ"}

@router.delete("/delete/{pid}")
def delete_product(pid: str, authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.begin() as c:
        c.execute(text("DELETE FROM affiliate_products WHERE id=:id AND tenant_id=:tid"),{"id":pid,"tid":tid})
    return {"message":"ลบสำเร็จ"}

@router.post("/click/{pid}")
def track_click(pid: str, source: str = ""):
    with engine.begin() as c:
        c.execute(text("UPDATE affiliate_products SET click_count=click_count+1 WHERE id=:id"),{"id":pid})
        c.execute(text("INSERT INTO affiliate_clicks(id,product_id,source) VALUES(:id,:pid,:src)"),
                  {"id":generate_id("clk"),"pid":pid,"src":source})
    return {"ok":True}

@router.post("/upload-media")
async def upload_media(file: UploadFile = File(...), authorization: str = Header("")):
    get_tenant_user(authorization)
    ext = os.path.splitext(file.filename)[1].lower()
    allowed_img = [".jpg",".jpeg",".png",".webp",".gif"]
    allowed_vid = [".mp4",".mov",".webm"]
    if ext not in allowed_img + allowed_vid:
        raise HTTPException(400,"รองรับเฉพาะ JPG/PNG/WEBP/MP4/MOV")
    content = await file.read()
    if len(content) > 50*1024*1024: raise HTTPException(400,"ไฟล์ใหญ่เกิน 50MB")
    fname = str(uuid.uuid4()) + ext
    with open(os.path.join(UPLOAD_DIR,fname),"wb") as f: f.write(content)
    media_type = "video" if ext in allowed_vid else "image"
    return {"url":f"/uploads/affiliate/{fname}","type":media_type}
