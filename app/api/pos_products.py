from fastapi import APIRouter, Header, HTTPException, UploadFile, File, Form
from sqlalchemy import text
from app.core.db import engine
from app.core.id_generator import generate_id
import jwt, os, base64, uuid

router = APIRouter(prefix="/api/pos/products", tags=["pos-products"])
JWT_SECRET = os.getenv("JWT_SECRET", "viiv_super_secret_jwt_key_2026_prod")
UPLOAD_DIR = "/home/viivadmin/viiv/frontend/uploads/products"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def get_tenant(authorization: str = ""):
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"], options={"leeway":864000, "verify_exp":False})
        tid = payload.get("tenant_id")
        if tid: return tid
        uid = payload.get("sub")
        with engine.connect() as c:
            if uid:
                u = c.execute(text("SELECT email FROM users WHERE id=:uid LIMIT 1"),{"uid":uid}).fetchone()
                if u:
                    t = c.execute(text("SELECT id FROM tenants WHERE email=:e LIMIT 1"),{"e":u[0]}).fetchone()
                    if t: return t[0]
            if payload.get("role") == "admin":
                t = c.execute(text("SELECT id FROM tenants ORDER BY created_at LIMIT 1")).fetchone()
                if t: return t[0]
    except: pass
    raise HTTPException(401, "Unauthorized")

@router.get("/list")
def list_products(authorization: str = Header("")):
    tid = get_tenant(authorization)
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT id,sku,name,description,image_url,price,cost_price,price_min,
                   pv,vat,category,track_stock,stock_qty,stock_floor,min_alert,
                   qr_url,status,created_at
            FROM products WHERE tenant_id=:tid ORDER BY created_at DESC
        """),{"tid":tid}).fetchall()
    return [dict(r._mapping) for r in rows]

@router.get("/categories")
def list_categories(authorization: str = Header("")):
    tid = get_tenant(authorization)
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT DISTINCT category FROM products
            WHERE tenant_id=:tid AND category != '' ORDER BY category
        """),{"tid":tid}).fetchall()
    return [r[0] for r in rows]

@router.post("/create")
def create_product(payload: dict, authorization: str = Header("")):
    tid = get_tenant(authorization)
    req = ["name","price","sku"]
    for f in req:
        if not str(payload.get(f,"")).strip():
            raise HTTPException(400, f"กรุณากรอก {f}")
    # เช็ค SKU ซ้ำ
    with engine.connect() as c:
        ex = c.execute(text("SELECT id FROM products WHERE tenant_id=:tid AND sku=:sku"),
                       {"tid":tid,"sku":payload["sku"]}).fetchone()
        if ex: raise HTTPException(400, "รหัสสินค้า (SKU) ซ้ำในร้านนี้")
    # track_stock validation
    track = payload.get("track_stock", True)
    if track and payload.get("stock_qty") is None:
        raise HTTPException(400, "กรุณาระบุจำนวนสต็อก")
    pid = generate_id("prd")
    with engine.begin() as c:
        c.execute(text("""
            INSERT INTO products
              (id,tenant_id,sku,name,description,image_url,price,cost_price,
               price_min,pv,vat,category,track_stock,stock_qty,stock_floor,
               min_alert,qr_url,status,updated_at)
            VALUES
              (:id,:tid,:sku,:name,:desc,:img,:price,:cost,
               :pmin,:pv,:vat,:cat,:track,:stock,:floor,
               :alert,:qr,:status,NOW())
        """),{
            "id":pid,"tid":tid,
            "sku":payload["sku"],"name":payload["name"],
            "desc":payload.get("description",""),
            "img":payload.get("image_url",""),
            "price":float(payload.get("price",0)),
            "cost":float(payload.get("cost_price",0)),
            "pmin":float(payload.get("price_min",0)),
            "pv":float(payload.get("pv",0)),
            "vat":payload.get("vat","no_vat"),
            "cat":payload.get("category",""),
            "track":bool(track),
            "stock":float(payload.get("stock_qty",0)),
            "floor":float(payload.get("stock_floor",0)),
            "alert":int(payload.get("min_alert",0)),
            "qr":payload.get("qr_url",""),
            "status":payload.get("status","active")
        })
    return {"id":pid,"message":"สร้างสินค้าสำเร็จ"}

@router.post("/upload-image")
async def upload_image(file: UploadFile = File(...), authorization: str = Header("")):
    get_tenant(authorization)
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".jpg",".jpeg",".png",".webp"]:
        raise HTTPException(400, "รองรับเฉพาะ JPG, PNG, WEBP")
    fname = str(uuid.uuid4()) + ext
    fpath = os.path.join(UPLOAD_DIR, fname)
    content = await file.read()
    if len(content) > 5*1024*1024:
        raise HTTPException(400, "ไฟล์ใหญ่เกิน 5MB")
    with open(fpath,"wb") as f:
        f.write(content)
    return {"url": f"/uploads/products/{fname}"}

@router.put("/update/{pid}")
def update_product(pid: str, payload: dict, authorization: str = Header("")):
    tid = get_tenant(authorization)
    with engine.begin() as c:
        c.execute(text("""
            UPDATE products SET
              name=:name, description=:desc, image_url=:img,
              price=:price, cost_price=:cost, price_min=:pmin,
              pv=:pv, vat=:vat, category=:cat,
              track_stock=:track, stock_qty=:stock, stock_floor=:floor,
              min_alert=:alert, qr_url=:qr, status=:status, updated_at=NOW()
            WHERE id=:id AND tenant_id=:tid
        """),{
            "id":pid,"tid":tid,
            "name":payload.get("name"),"desc":payload.get("description",""),
            "img":payload.get("image_url",""),
            "price":float(payload.get("price",0)),
            "cost":float(payload.get("cost_price",0)),
            "pmin":float(payload.get("price_min",0)),
            "pv":float(payload.get("pv",0)),
            "vat":payload.get("vat","no_vat"),
            "cat":payload.get("category",""),
            "track":bool(payload.get("track_stock",True)),
            "stock":float(payload.get("stock_qty",0)),
            "floor":float(payload.get("stock_floor",0)),
            "alert":int(payload.get("min_alert",0)),
            "qr":payload.get("qr_url",""),
            "status":payload.get("status","active")
        })
    return {"message":"อัพเดทสำเร็จ"}

@router.post("/upload-icon")
async def upload_app_icon(file: UploadFile = File(...)):
    import shutil
    ext = file.filename.split('.')[-1].lower()
    if ext not in ['png','jpg','jpeg','webp']:
        raise HTTPException(status_code=400, detail="ไฟล์ต้องเป็น PNG/JPG/WEBP")
    dest = "/home/viivadmin/viiv/frontend/superboard/logo-original." + ext
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    try:
        from PIL import Image
        img = Image.open(dest).convert("RGBA")
        for size in [192, 512]:
            img.resize((size,size), Image.LANCZOS).save(
                f"/home/viivadmin/viiv/frontend/superboard/icon-{size}.png"
            )
        img.resize((32,32), Image.LANCZOS).save(
            "/home/viivadmin/viiv/frontend/superboard/favicon.ico", format="ICO"
        )
        shutil.copy(
            "/home/viivadmin/viiv/frontend/superboard/favicon.ico",
            "/home/viivadmin/viiv/frontend/favicon.ico"
        )
        shutil.copy(
            "/home/viivadmin/viiv/frontend/superboard/favicon.ico",
            "/home/viivadmin/viiv/modules/pos/merchant/ui/dashboard/favicon.ico"
        )
    except Exception as e:
        return {"url": f"/superboard/logo-original.{ext}", "warning": str(e)}
    return {"url": "/superboard/icon-192.png"}

@router.get("/public/list")
def public_list_products(tenant: str = ""):
    """Public endpoint - ไม่ต้องใช้ token"""
    with engine.connect() as c:
        if tenant:
            rows = c.execute(text("""
                SELECT id,sku,name,description,image_url,price,cost_price,price_min,
                       pv,vat,category,track_stock,stock_qty,status
                FROM products WHERE tenant_id=:tid AND status='active' ORDER BY created_at DESC
            """),{"tid":tenant}).fetchall()
        else:
            # default: ใช้ tenant แรก
            t = c.execute(text("SELECT id FROM tenants ORDER BY created_at LIMIT 1")).fetchone()
            if not t: return []
            rows = c.execute(text("""
                SELECT id,sku,name,description,image_url,price,cost_price,price_min,
                       pv,vat,category,track_stock,stock_qty,status
                FROM products WHERE tenant_id=:tid AND status='active' ORDER BY created_at DESC
            """),{"tid":t[0]}).fetchall()
    return [dict(r._mapping) for r in rows]

@router.get("/public/store")
def public_store_info(tenant: str = ""):
    """Public store settings"""
    with engine.connect() as c:
        if not tenant:
            t = c.execute(text("SELECT id FROM tenants ORDER BY created_at LIMIT 1")).fetchone()
            if not t: return {}
            tenant = t[0]
        r = c.execute(text("SELECT * FROM store_settings WHERE tenant_id=:tid"),{"tid":tenant}).fetchone()
    if not r: return {"store_name":"My Shop","logo_url":""}
    return dict(r._mapping)
