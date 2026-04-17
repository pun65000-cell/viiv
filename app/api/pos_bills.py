from fastapi import APIRouter, Header, HTTPException
from sqlalchemy import text
from app.core.db import engine
from app.core.id_generator import generate_id
import jwt, os, json
from datetime import datetime

router = APIRouter(prefix="/api/pos/bills", tags=["pos-bills"])
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

def gen_bill_no(tid, conn):
    settings = conn.execute(text("SELECT bill_prefix,bill_start_seq,bill_format,inv_prefix FROM store_settings WHERE tenant_id=:tid"),{"tid":tid}).fetchone()
    seq_row = conn.execute(text("SELECT last_seq FROM bill_seq WHERE tenant_id=:tid FOR UPDATE"),{"tid":tid}).fetchone()
    prefix = (settings[0] if settings else None) or "BILL"
    start = (settings[1] if settings else None) or 1
    inv_prefix = (settings[3] if settings else None) or "INV"
    new_seq = max((seq_row[0]+1 if seq_row else start), start)
    if seq_row:
        conn.execute(text("UPDATE bill_seq SET last_seq=:s,updated_at=NOW() WHERE tenant_id=:tid"),{"s":new_seq,"tid":tid})
    else:
        conn.execute(text("INSERT INTO bill_seq(tenant_id,last_seq,prefix,start_seq) VALUES(:tid,:s,:p,:st)"),{"tid":tid,"s":new_seq,"p":prefix,"st":start})
    year = datetime.now().strftime("%Y")
    bill_no = f"{prefix}-{year}-{str(new_seq).zfill(6)}"
    inv_no = f"{inv_prefix}-{str(new_seq).zfill(6)}"
    return bill_no, inv_no, new_seq

@router.post("/create")
def create_bill(payload: dict, authorization: str = Header("")):
    tid, uid = get_tenant_user(authorization)
    items = payload.get("items", [])
    if not items: raise HTTPException(400, "กรุณาเพิ่มสินค้า")
    status = payload.get("status", "paid")
    with engine.begin() as c:
        items_snap = []
        for item in items:
            p = c.execute(text("SELECT id,sku,name,price,cost_price FROM products WHERE id=:id AND tenant_id=:tid"),{"id":item.get("id"),"tid":tid}).fetchone()
            items_snap.append({"id":item.get("id"),"sku":p[1] if p else item.get("sku",""),"name":p[2] if p else item.get("name",""),"qty":float(item.get("qty",1)),"price":float(item.get("price",p[3] if p else 0)),"cost_at_sale":float(p[4]) if p else 0})
        bill_no, inv_no, seq = gen_bill_no(tid, c)
        bid = generate_id("bill")
        sub = sum(i["qty"]*i["price"] for i in items_snap)
        dv = float(payload.get("discount",0)); dt = payload.get("discount_type","amount")
        disc = sub*dv/100 if dt=="percent" else dv
        after = max(0,sub-disc)
        vr = int(payload.get("vat",0)); va = after*vr/100; total = after+va
        src = payload.get("source","billing")
        ship_st = payload.get("shipping_status", None)
        sched = payload.get("scheduled_at")
        c.execute(text("""INSERT INTO bills(id,tenant_id,bill_no,inv_no,doc_type,status,source,shipping_status,scheduled_at,customer_id,customer_name,customer_code,customer_data,items,subtotal,discount,discount_type,vat_rate,vat_amount,total,pay_method,paid_amount,note,created_by,created_at,updated_at)
            VALUES(:id,:tid,:bno,:ino,:dt,:st,:src,:ship,:sched,:cid,:cn,:cc,:cd,:items,:sub,:disc,:dtype,:vr,:va,:total,:pm,:paid,:note,:uid,NOW(),NOW())"""),
            {"id":bid,"tid":tid,"bno":bill_no,"ino":inv_no,"dt":payload.get("doc_type","receipt"),"st":status,
             "src":src,"ship":ship_st,"sched":sched,
             "cid":(payload.get("customer_data") or {}).get("id"),"cn":payload.get("customer",""),"cc":payload.get("customer_code",""),
             "cd":json.dumps(payload.get("customer_data")) if payload.get("customer_data") else None,
             "items":json.dumps(items_snap),"sub":sub,"disc":disc,"dtype":dt,"vr":vr,"va":va,"total":total,
             "pm":payload.get("pay_method","cash"),"paid":float(payload.get("paid",0)),"note":payload.get("note",""),"uid":uid})
        if status=="paid":
            for item in items_snap:
                p = c.execute(text("SELECT stock_qty,track_stock FROM products WHERE id=:id"),{"id":item["id"]}).fetchone()
                if p and p[1]:
                    qb=float(p[0] or 0); qa=qb-item["qty"]
                    c.execute(text("UPDATE products SET stock_qty=:q,updated_at=NOW() WHERE id=:id"),{"q":qa,"id":item["id"]})
                    c.execute(text("INSERT INTO stock_log(id,tenant_id,product_id,sku,product_name,action,qty_before,qty_change,qty_after,ref_bill_id,ref_bill_no,created_by) VALUES(:id,:tid,:pid,:sku,:name,'sale',:qb,:qc,:qa,:bid,:bno,:uid)"),
                        {"id":generate_id("slog"),"tid":tid,"pid":item["id"],"sku":item["sku"],"name":item["name"],"qb":qb,"qc":-item["qty"],"qa":qa,"bid":bid,"bno":bill_no,"uid":uid})
    return {"id":bid,"bill_no":bill_no,"inv_no":inv_no,"total":total,"status":status}

@router.get("/list")
def list_bills(authorization: str = Header(""), status: str = "", doc_type: str = "", q: str = "", source: str = ""):
    tid, _ = get_tenant_user(authorization)
    filters = "WHERE tenant_id=:tid AND status != 'deleted'"
    params = {"tid":tid}
    if status: filters += " AND status=:status"; params["status"]=status
    if doc_type: filters += " AND doc_type=:dt"; params["dt"]=doc_type
    if q: filters += " AND (bill_no ILIKE :q OR customer_name ILIKE :q OR customer_code ILIKE :q)"; params["q"]=f"%{q}%"
    if source: filters += " AND source=:source"; params["source"]=source
    with engine.connect() as c:
        rows = c.execute(text(f"SELECT id,bill_no,inv_no,doc_type,status,shipping_status,source,scheduled_at,ship_photo_url,ship_note,customer_name,customer_code,total,pay_method,paid_amount,note,created_at,voided_at,void_reason FROM bills {filters} ORDER BY created_at DESC LIMIT 500"),params).fetchall()
    return [dict(r._mapping) for r in rows]

VALID_FINANCIAL = {'pending','paid','partial','credit','voided','deleted'}
VALID_SHIPPING = {
    'pending','scheduled','packing_in','packing_out',
    'shipped_no_recipient','shipped_cod','shipped_collect',
    'chargeback','bill_check','overdue',
    'received_payment','pending_payment','cod'
}

@router.post("/update-status/{bid}")
def update_bill_status(bid: str, payload: dict, authorization: str = Header("")):
    tid, uid = get_tenant_user(authorization)
    new_status = payload.get("status")
    new_shipping = payload.get("shipping_status")
    slip_url = payload.get("slip_url")
    if new_status and new_status not in VALID_FINANCIAL:
        raise HTTPException(400, f"invalid status: {new_status}")
    if new_shipping and new_shipping not in VALID_SHIPPING:
        raise HTTPException(400, f"invalid shipping_status: {new_shipping}")
    with engine.begin() as c:
        bill = c.execute(text("SELECT id,source FROM bills WHERE id=:id AND tenant_id=:tid"),{"id":bid,"tid":tid}).fetchone()
        if not bill: raise HTTPException(404,"ไม่พบบิล")
        sets, params = [], {"id":bid}
        if new_status:
            sets.append("status=:status"); params["status"]=new_status
        if new_shipping is not None:
            if bill.source == "pos":
                raise HTTPException(400,"บิล POS ไม่สามารถอัพเดท shipping_status ได้")
            sets.append("shipping_status=:shipping"); params["shipping"]=new_shipping
        if slip_url:
            sets.append("slip_url=:slip"); params["slip"]=slip_url
        if not sets: raise HTTPException(400,"ไม่มีข้อมูลที่จะอัพเดท")
        sets.append("updated_at=NOW()")
        c.execute(text(f"UPDATE bills SET {','.join(sets)} WHERE id=:id"),params)
    return {"ok":True,"bill_id":bid}

@router.get("/detail/{bid}")
def get_bill(bid: str, authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.connect() as c:
        r = c.execute(text("SELECT * FROM bills WHERE id=:id AND tenant_id=:tid"),{"id":bid,"tid":tid}).fetchone()
        if not r: raise HTTPException(404,"ไม่พบบิล")
    return dict(r._mapping)

@router.post("/void/{bid}")
def void_bill(bid: str, payload: dict, authorization: str = Header("")):
    tid, uid = get_tenant_user(authorization)
    void_type = payload.get("void_type","cancel")
    reason = payload.get("reason","")
    if not reason: raise HTTPException(400,"กรุณาระบุเหตุผล")
    with engine.begin() as c:
        bill = c.execute(text("SELECT * FROM bills WHERE id=:id AND tenant_id=:tid"),{"id":bid,"tid":tid}).fetchone()
        if not bill: raise HTTPException(404,"ไม่พบบิล")
        if bill.status in ("voided","deleted"): raise HTTPException(400,"บิลนี้ถูกยกเลิกแล้ว")
        c.execute(text("INSERT INTO bill_void_log(id,tenant_id,bill_id,bill_no,void_type,void_reason,items_snapshot,total,voided_by) VALUES(:id,:tid,:bid,:bno,:vt,:vr,:items,:total,:uid)"),
            {"id":generate_id("vlog"),"tid":tid,"bid":bid,"bno":bill.bill_no,"vt":void_type,"vr":reason,"items":bill.items,"total":bill.total,"uid":uid})
        if void_type=="delete_with_return":
            items = json.loads(bill.items) if isinstance(bill.items,str) else bill.items
            for item in items:
                p = c.execute(text("SELECT stock_qty,track_stock FROM products WHERE id=:id"),{"id":item["id"]}).fetchone()
                if p and p[1]:
                    qb=float(p[0] or 0); qa=qb+item["qty"]
                    c.execute(text("UPDATE products SET stock_qty=:q,updated_at=NOW() WHERE id=:id"),{"q":qa,"id":item["id"]})
                    c.execute(text("INSERT INTO stock_log(id,tenant_id,product_id,sku,product_name,action,qty_before,qty_change,qty_after,ref_bill_id,ref_bill_no,note,created_by) VALUES(:id,:tid,:pid,:sku,:name,'void_return',:qb,:qc,:qa,:bid,:bno,:note,:uid)"),
                        {"id":generate_id("slog"),"tid":tid,"pid":item["id"],"sku":item.get("sku",""),"name":item.get("name",""),"qb":qb,"qc":item["qty"],"qa":qa,"bid":bid,"bno":bill.bill_no,"note":f"คืนสต็อก {bill.bill_no}","uid":uid})
        new_st = "voided" if void_type=="cancel" else "deleted"
        c.execute(text("UPDATE bills SET status=:st,void_reason=:vr,voided_by=:uid,voided_at=NOW(),updated_at=NOW() WHERE id=:id"),{"st":new_st,"vr":reason,"uid":uid,"id":bid})
    return {"message":"ยกเลิกสำเร็จ","void_type":void_type}

@router.get("/void-log")
def void_log(authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.connect() as c:
        rows = c.execute(text("SELECT id,bill_id,bill_no,void_type,void_reason,total,voided_by,voided_at FROM bill_void_log WHERE tenant_id=:tid ORDER BY voided_at DESC LIMIT 200"),{"tid":tid}).fetchall()
    return [dict(r._mapping) for r in rows]

@router.post("/migrate")
def migrate_bill(payload: dict, authorization: str = Header("")):
    """รับบิลเก่าจาก localStorage มาเก็บใน DB"""
    tid, uid = get_tenant_user(authorization)
    import json as _json
    # ถ้ามี bill_no นี้แล้วให้ skip
    bill_no = payload.get("id","")
    with engine.connect() as c:
        ex = c.execute(text("SELECT id FROM bills WHERE tenant_id=:tid AND (bill_no=:bno OR id=:bno)"),
                       {"tid":tid,"bno":bill_no}).fetchone()
        if ex: return {"message":"already exists","bill_no":bill_no}
    items = payload.get("items",[])
    sub = sum(float(i.get("qty",1))*float(i.get("price",0)) for i in items)
    dv = float(payload.get("discount",0))
    dt = payload.get("discount_type","amount")
    disc = sub*dv/100 if dt=="percent" else dv
    after = max(0,sub-disc)
    vr = int(payload.get("vat",0))
    total = float(payload.get("total",after+after*vr/100))
    bid = generate_id("bill")
    with engine.begin() as c:
        c.execute(text("""
            INSERT INTO bills(id,tenant_id,bill_no,inv_no,doc_type,status,
              customer_name,customer_code,customer_data,items,
              subtotal,discount,discount_type,vat_rate,vat_amount,total,
              pay_method,paid_amount,note,void_reason,created_by,created_at,updated_at)
            VALUES(:id,:tid,:bno,:ino,:dt,:st,
              :cn,:cc,:cd,:items,
              :sub,:disc,:dtype,:vr,:va,:total,
              :pm,:paid,:note,:voidr,:uid,:cat,NOW())
        """),{
            "id":bid,"tid":tid,
            "bno":bill_no,
            "ino":bill_no.replace("BILL","INV") if "BILL" in bill_no else "",
            "dt":payload.get("doc_type","receipt"),
            "st":payload.get("status","paid"),
            "cn":payload.get("customer",""),
            "cc":payload.get("customer_code","") or (payload.get("customer_data") or {}).get("code",""),
            "cd":_json.dumps(payload.get("customer_data")) if payload.get("customer_data") else None,
            "items":_json.dumps(items),
            "sub":sub,"disc":disc,"dtype":dt,"vr":vr,
            "va":after*vr/100,"total":total,
            "pm":payload.get("pay_method","cash"),
            "paid":float(payload.get("paid",0)),
            "note":payload.get("note",""),
            "voidr":payload.get("void_reason",""),
            "uid":uid,
            "cat":payload.get("created_at","NOW()")
        })
    return {"message":"migrated","bill_no":bill_no,"id":bid}


import shutil, uuid
from fastapi import UploadFile, File

@router.post("/upload-slip")
async def upload_slip(file: UploadFile = File(...), authorization: str = Header("")):
    tid, uid = get_tenant_user(authorization)
    ext = file.filename.rsplit(".",1)[-1].lower() if "." in file.filename else "jpg"
    fname = f"{uuid.uuid4().hex}.{ext}"
    dest = f"/home/viivadmin/viiv/uploads/slips/{fname}"
    import os; os.makedirs("/home/viivadmin/viiv/uploads/slips", exist_ok=True)
    with open(dest,"wb") as f: shutil.copyfileobj(file.file, f)
    return {"url": f"/uploads/slips/{fname}"}
