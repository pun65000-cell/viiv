import os, uuid
import jwt
from fastapi import APIRouter, Header, HTTPException, UploadFile, File
from sqlalchemy import text
from app.core.db import engine

router = APIRouter(prefix="/api/pos/receive", tags=["pos-receive"])
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
    raise HTTPException(401)

def gen_id(prefix="rcv"):
    import time, random, string
    return prefix+"_"+str(int(time.time()))+"_"+"".join(random.choices(string.ascii_lowercase+string.digits,k=4))

def get_staff_name(uid, tid):
    with engine.connect() as c:
        s = c.execute(text("SELECT first_name,last_name FROM tenant_staff WHERE id=:id AND tenant_id=:tid"),{"id":uid,"tid":tid}).fetchone()
        if s: return ((s.first_name or "")+" "+(s.last_name or "")).strip()
        u = c.execute(text("SELECT full_name,email FROM users WHERE id=:id"),{"id":uid}).fetchone()
        if u and u.full_name: return u.full_name
        if u and u.email: return u.email.split("@")[0]
    return uid

@router.get("/list")
def list_receives(limit: int=20, page: int=1, authorization: str=Header("")):
    tid, _ = get_tenant_user(authorization)
    offset = (page-1)*limit
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT r.*,
            (SELECT json_agg(i.*) FROM stock_receive_items i WHERE i.receive_id=r.id) as items
            FROM stock_receive r
            WHERE r.tenant_id=:tid AND r.status='active'
            ORDER BY r.created_at DESC LIMIT :lim OFFSET :off"""),
            {"tid":tid,"lim":limit,"off":offset}).fetchall()
        total = c.execute(text("SELECT COUNT(*) FROM stock_receive WHERE tenant_id=:tid AND status='active'"),{"tid":tid}).scalar()
        import json
        result = []
        for r in rows:
            d = dict(r._mapping)
            if d.get("items") and isinstance(d["items"],str):
                d["items"] = json.loads(d["items"])
            result.append(d)
        return {"items": result, "total": total}

@router.post("/create")
def create_receive(payload: dict, authorization: str=Header("")):
    tid, uid = get_tenant_user(authorization)
    rid = gen_id("rcv")
    staff = get_staff_name(uid, tid)
    items = payload.get("items",[])
    total = sum(float(i.get("qty",0))*float(i.get("cost_price",0)) for i in items)
    with engine.begin() as c:
        c.execute(text("""INSERT INTO stock_receive(id,tenant_id,partner_id,partner_name,partner_code,
            receive_date,created_by,staff_name,total_amount,bill_image_url,note,status,created_at,updated_at)
            VALUES(:id,:tid,:pid,:pname,:pcode,:rdate,:uid,:staff,:total,:img,:note,'active',NOW(),NOW())"""),
            {"id":rid,"tid":tid,
             "pid":payload.get("partner_id",""),"pname":payload.get("partner_name",""),
             "pcode":payload.get("partner_code",""),
             "rdate":payload.get("receive_date") or "NOW()",
             "uid":uid,"staff":staff,
             "total":total,"img":payload.get("bill_image_url",""),
             "note":payload.get("note","")})
        for item in items:
            iid = gen_id("rci")
            qty = float(item.get("qty",0))
            cost = float(item.get("cost_price",0))
            c.execute(text("""INSERT INTO stock_receive_items(id,receive_id,tenant_id,product_id,
                product_name,sku,qty,cost_price,warehouse,total,created_at)
                VALUES(:id,:rid,:tid,:pid,:pname,:sku,:qty,:cost,:wh,:total,NOW())"""),
                {"id":iid,"rid":rid,"tid":tid,
                 "pid":item.get("product_id",""),"pname":item.get("product_name",""),
                 "sku":item.get("sku",""),"qty":qty,"cost":cost,
                 "wh":item.get("warehouse","back"),"total":qty*cost})
            # update stock
            c.execute(text("""UPDATE products SET stock_qty=COALESCE(stock_qty,0)+:qty,
                cost_price=CASE WHEN :cost>0 THEN :cost ELSE cost_price END,
                updated_at=NOW() WHERE id=:pid AND tenant_id=:tid"""),
                {"qty":qty,"cost":cost,"pid":item.get("product_id",""),"tid":tid})
            # stock_log
            lid = gen_id("stl")
            c.execute(text("""INSERT INTO stock_log(id,tenant_id,product_id,sku,product_name,
                action,qty_change,ref_bill_id,ref_bill_no,created_by)
                VALUES(:id,:tid,:pid,:sku,:pname,'receive',:qty,:rid,:rid,:uid)"""),
                {"id":lid,"tid":tid,"pid":item.get("product_id",""),
                 "sku":item.get("sku",""),"pname":item.get("product_name",""),
                 "qty":qty,"rid":rid,"uid":uid})
        # log
        c.execute(text("""INSERT INTO stock_receive_log(id,receive_id,tenant_id,action,detail,staff_name,created_at)
            VALUES(:id,:rid,:tid,'create','สร้างรายการรับสินค้า',:staff,NOW())"""),
            {"id":gen_id("rcl"),"rid":rid,"tid":tid,"staff":staff})
    return {"id":rid,"message":"success"}

@router.delete("/delete/{rid}")
def delete_receive(rid: str, payload: dict={}, authorization: str=Header("")):
    tid, uid = get_tenant_user(authorization)
    staff = get_staff_name(uid, tid)
    with engine.begin() as c:
        c.execute(text("""UPDATE stock_receive SET status='deleted',deleted_at=NOW(),
            deleted_by=:uid,delete_reason=:reason,updated_at=NOW()
            WHERE id=:rid AND tenant_id=:tid"""),
            {"rid":rid,"tid":tid,"uid":uid,"reason":payload.get("reason","")})
        c.execute(text("""INSERT INTO stock_receive_log(id,receive_id,tenant_id,action,detail,staff_name,created_at)
            VALUES(:id,:rid,:tid,'delete',:reason,:staff,NOW())"""),
            {"id":gen_id("rcl"),"rid":rid,"tid":tid,
             "reason":payload.get("reason","ลบโดยผู้ใช้"),"staff":staff})
    return {"message":"deleted"}

@router.post("/upload-bill/{rid}")
async def upload_bill(rid: str, file: UploadFile=File(...), authorization: str=Header("")):
    tid, _ = get_tenant_user(authorization)
    content = await file.read()
    if len(content) > 10*1024*1024: raise HTTPException(400,"File too large")
    ext = os.path.splitext(file.filename)[1].lower()
    doc_dir = f"/home/viivadmin/viiv/uploads/receive/{tid}"
    os.makedirs(doc_dir, exist_ok=True)
    fname = str(uuid.uuid4())+ext
    with open(os.path.join(doc_dir,fname),"wb") as f: f.write(content)
    url = f"/uploads/receive/{tid}/{fname}"
    with engine.begin() as c:
        c.execute(text("UPDATE stock_receive SET bill_image_url=:url WHERE id=:rid AND tenant_id=:tid"),
            {"url":url,"rid":rid,"tid":tid})
    return {"url":url}
