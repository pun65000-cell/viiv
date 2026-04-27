from fastapi import APIRouter, Header, HTTPException
from sqlalchemy import text
from app.core.db import engine
from app.core.id_generator import generate_id
import jwt, os, json
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/pos/bills", tags=["pos-bills"])
JWT_SECRET = os.getenv("JWT_SECRET", "")
MIGRATION_MODE = os.getenv("MIGRATION_MODE", "")

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

def _snapshot_member(c, tid, member_id, fallback):
    """ดึงข้อมูลสมาชิกครบจาก members table ถ้ามี member_id"""
    if member_id:
        row = c.execute(text("""SELECT id,code,name,phone,tax_id,address,email,birthday,geo,credit_limit,credit,note
            FROM members WHERE id=:id AND tenant_id=:tid"""), {"id":member_id,"tid":tid}).fetchone()
        if row:
            return {"id":row[0],"code":row[1],"name":row[2],"phone":row[3],"tax_id":row[4],
                    "address":row[5],"email":row[6],"birthday":str(row[7]) if row[7] else None,
                    "geo":row[8],"credit_limit":float(row[9] or 0),"credit":float(row[10] or 0),"note":row[11]}
    return fallback or {}

@router.post("/create")
def create_bill(payload: dict, authorization: str = Header("")):
    tid, uid = get_tenant_user(authorization)
    items = payload.get("items", [])
    if not items: raise HTTPException(400, "กรุณาเพิ่มสินค้า")
    doc_type = payload.get("doc_type","receipt")
    pm = payload.get("pay_method", "cash")
    # backend is single source of truth for status + shipping cascade
    PAY_MAP = {
        "cash":             {"status": "paid",    "shipping": "received_payment", "delay": 0},
        "transfer":         {"status": "paid",    "shipping": "received_payment", "delay": 0},
        "cash_waiting":     {"status": "paid",    "shipping": "paid_waiting",     "delay": 15},
        "transfer_waiting": {"status": "paid",    "shipping": "paid_waiting",     "delay": 15},
        "deposit":          {"status": "partial", "shipping": "deposit_waiting",  "delay": 30},
        "credit":           {"status": "credit",  "shipping": "scheduled",        "delay": 45},
        "pending":          {"status": "pending", "shipping": None,               "delay": 0},
    }
    _map = PAY_MAP.get(pm, {"status": "pending", "shipping": None, "delay": 0})
    if doc_type == "reserve":
        status = "pending"
        ship_st = None
    else:
        status = _map["status"]
        ship_st = _map["shipping"]
    # scheduled_at: use frontend value if provided, else compute from pay_method delay
    sched = payload.get("scheduled_at")
    if not sched and _map["delay"] > 0:
        sched = (datetime.now() + timedelta(minutes=_map["delay"])).isoformat()
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
        vr = int(payload.get("vat",0))
        vat_type = payload.get("vat_type","included")
        if vr == 0:
            va = 0; total = after
        elif vat_type == "included":
            va = round(after - after/(1+vr/100), 2); total = after
        else:
            va = round(after*vr/100, 2); total = after+va
        src = payload.get("source","billing")
        c.execute(text("""INSERT INTO bills(id,tenant_id,bill_no,inv_no,doc_type,status,source,shipping_status,scheduled_at,customer_id,customer_name,customer_code,customer_data,items,subtotal,discount,discount_type,vat_rate,vat_amount,vat_type,total,pay_method,paid_amount,note,created_by,created_at,updated_at)
            VALUES(:id,:tid,:bno,:ino,:dt,:st,:src,:ship,:sched,:cid,:cn,:cc,:cd,:items,:sub,:disc,:dtype,:vr,:va,:vtype,:total,:pm,:paid,:note,:uid,NOW(),NOW())"""),
            {"id":bid,"tid":tid,"bno":bill_no,"ino":inv_no,"dt":doc_type,"st":status,
             "src":src,"ship":ship_st,"sched":sched,
             "cid":(payload.get("customer_data") or {}).get("id"),"cn":payload.get("customer",""),"cc":payload.get("customer_code",""),
             "cd":json.dumps(_snapshot_member(c, tid, (payload.get("customer_data") or {}).get("id"), payload.get("customer_data"))),
             "items":json.dumps(items_snap),"sub":sub,"disc":disc,"dtype":dt,"vr":vr,"va":va,"vtype":vat_type,"total":total,
             "pm":payload.get("pay_method","cash"),"paid":float(payload.get("paid",0)),"note":payload.get("note",""),"uid":uid})
        if doc_type == "reserve":
            for item in items_snap:
                p = c.execute(text("SELECT track_stock FROM products WHERE id=:id"),{"id":item["id"]}).fetchone()
                if p and p[0]:
                    c.execute(text("UPDATE products SET stock_reserved=COALESCE(stock_reserved,0)+:qty,updated_at=NOW() WHERE id=:id"),{"qty":item["qty"],"id":item["id"]})
        elif status=="paid":
            for item in items_snap:
                p = c.execute(text("SELECT stock_qty,track_stock FROM products WHERE id=:id"),{"id":item["id"]}).fetchone()
                if p and p[1]:
                    qb=float(p[0] or 0); qa=qb-item["qty"]
                    c.execute(text("UPDATE products SET stock_qty=:q,updated_at=NOW() WHERE id=:id"),{"q":qa,"id":item["id"]})
                    c.execute(text("INSERT INTO stock_log(id,tenant_id,product_id,sku,product_name,action,qty_before,qty_change,qty_after,ref_bill_id,ref_bill_no,created_by) VALUES(:id,:tid,:pid,:sku,:name,'sale',:qb,:qc,:qa,:bid,:bno,:uid)"),
                        {"id":generate_id("slog"),"tid":tid,"pid":item["id"],"sku":item["sku"],"name":item["name"],"qb":qb,"qc":-item["qty"],"qa":qa,"bid":bid,"bno":bill_no,"uid":uid})
    return {"id":bid,"bill_no":bill_no,"inv_no":inv_no,"total":total,"status":status}


@router.post("/save-draft")
def save_draft(payload: dict, authorization: str = Header("")):
    tid, uid = get_tenant_user(authorization)
    items = payload.get("items", [])
    bid = payload.get("draft_id") or generate_id("bill")
    with engine.begin() as conn:
        existing = conn.execute(text("SELECT id FROM bills WHERE id=:id AND tenant_id=:tid AND status='draft'"),{"id":bid,"tid":tid}).fetchone()
        sub = sum(float(i.get("qty",1))*float(i.get("price",0)) for i in items)
        dv = float(payload.get("discount",0))
        dt = payload.get("discount_type","amount")
        disc = sub*dv/100 if dt=="percent" else dv
        after = max(0,sub-disc)
        vr = int(payload.get("vat",0))
        va = after*vr/100
        total = after+va
        sched = payload.get("scheduled_at")
        if existing:
            conn.execute(text("""UPDATE bills SET items=:items,customer_name=:cn,customer_code=:cc,
                customer_data=:cd,subtotal=:sub,discount=:disc,discount_type=:dtype,
                vat_rate=:vr,vat_amount=:va,total=:total,pay_method=:pm,note=:note,
                scheduled_at=:sched,updated_at=NOW() WHERE id=:id AND tenant_id=:tid"""),
                {"id":bid,"tid":tid,"items":json.dumps(items),
                 "cn":payload.get("customer",""),"cc":payload.get("customer_code",""),
                 "cd":json.dumps(payload.get("customer_data")) if payload.get("customer_data") else None,
                 "sub":sub,"disc":disc,"dtype":dt,"vr":vr,"va":va,"total":total,
                 "pm":payload.get("pay_method","cash"),"note":payload.get("note",""),
                 "sched":sched})
        else:
            bill_no = f"DRAFT-{bid[-8:].upper()}"
            conn.execute(text("""INSERT INTO bills(id,tenant_id,bill_no,inv_no,doc_type,status,source,
                customer_name,customer_code,customer_data,items,subtotal,discount,discount_type,
                vat_rate,vat_amount,total,pay_method,paid_amount,note,scheduled_at,created_by,created_at,updated_at)
                VALUES(:id,:tid,:bno,:ino,:dt,:st,:src,:cn,:cc,:cd,:items,:sub,:disc,:dtype,:vr,:va,:total,:pm,0,:note,:sched,:uid,NOW(),NOW())"""),
                {"id":bid,"tid":tid,"bno":bill_no,"ino":"","dt":payload.get("doc_type","receipt"),
                 "st":"draft","src":"billing","cn":payload.get("customer",""),
                 "cc":payload.get("customer_code",""),
                 "cd":json.dumps(payload.get("customer_data")) if payload.get("customer_data") else None,
                 "items":json.dumps(items),"sub":sub,"disc":disc,"dtype":dt,"vr":vr,"va":va,"total":total,
                 "pm":payload.get("pay_method","cash"),"note":payload.get("note",""),"sched":sched,"uid":uid})
    return {"ok":True,"draft_id":bid}

@router.post("/finalize-draft/{bid}")
def finalize_draft(bid: str, authorization: str = Header("")):
    tid, uid = get_tenant_user(authorization)
    with engine.begin() as c:
        row = c.execute(text(
            "SELECT id, bill_no, status FROM bills WHERE id=:id AND tenant_id=:tid"
        ), {"id": bid, "tid": tid}).fetchone()
        if not row:
            raise HTTPException(404, "ไม่พบบิล")
        if row.status != "draft":
            raise HTTPException(400, f"สถานะปัจจุบัน '{row.status}' ไม่ใช่ draft")
        if not str(row.bill_no).startswith("DRAFT-"):
            raise HTTPException(400, "bill_no ไม่ใช่ DRAFT format")
        bill_no, inv_no, _ = gen_bill_no(tid, c)
        c.execute(text(
            "UPDATE bills SET bill_no=:bno, inv_no=:ino, status='pending', updated_at=NOW() "
            "WHERE id=:id AND tenant_id=:tid"
        ), {"bno": bill_no, "ino": inv_no, "id": bid, "tid": tid})
    return {"ok": True, "bill_no": bill_no, "inv_no": inv_no}

@router.get("/list")
def list_bills(authorization: str = Header(""), status: str = "", doc_type: str = "", q: str = "", source: str = "", sort: str = "", limit: int = 500):
    tid, _ = get_tenant_user(authorization)
    filters = "WHERE tenant_id=:tid AND status != 'deleted'"
    params = {"tid":tid}
    if status: filters += " AND status=:status"; params["status"]=status
    if doc_type: filters += " AND doc_type=:dt"; params["dt"]=doc_type
    if q: filters += " AND (bill_no ILIKE :q OR customer_name ILIKE :q OR customer_code ILIKE :q)"; params["q"]=f"%{q}%"
    if source: filters += " AND source=:source"; params["source"]=source
    order_col = "updated_at" if sort == "updated_at" else "created_at"
    cap = min(max(1, limit), 500)
    with engine.connect() as c:
        rows = c.execute(text(f"SELECT id,bill_no,inv_no,doc_type,status,shipping_status,source,scheduled_at,ship_photo_url,ship_note,ship_report,activity_log,customer_name,customer_code,customer_data,items,total,pay_method,paid_amount,note,created_at,updated_at,voided_at,void_reason FROM bills {filters} ORDER BY {order_col} DESC LIMIT {cap}"),params).fetchall()
    return {"bills": [dict(r._mapping) for r in rows]}

VALID_FINANCIAL = {'pending','paid','partial','credit','voided','deleted','paid_waiting','transfer_paid','transfer_waiting'}
VALID_SHIPPING = {
    'pending','scheduled','packing_in','packing_out',
    'shipped_no_recipient','shipped_cod','shipped_collect',
    'chargeback','bill_check','overdue','delivery',
    'received_payment','pending_payment','cod',
    'paid_waiting','deposit_waiting','debt_collection','debt',
}

LOCK_SHIPPING = set()

@router.post("/update-status/{bid}")
def update_bill_status(bid: str, payload: dict, authorization: str = Header("")):
    from datetime import datetime, timezone
    tid, uid = get_tenant_user(authorization)
    new_status = payload.get("status")
    new_shipping = payload.get("shipping_status")
    ship_photo = payload.get("ship_photo_url")
    ship_note = payload.get("ship_note")
    ship_report = payload.get("ship_report")
    scheduled_at = payload.get("scheduled_at")

    if new_status and new_status not in VALID_FINANCIAL:
        raise HTTPException(400, f"invalid status: {new_status}")
    if new_shipping and new_shipping not in VALID_SHIPPING:
        raise HTTPException(400, f"invalid shipping_status: {new_shipping}")

    with engine.begin() as c:
        bill = c.execute(text("SELECT id,source,shipping_status,status,activity_log FROM bills WHERE id=:id AND tenant_id=:tid"),{"id":bid,"tid":tid}).fetchone()
        if not bill: raise HTTPException(404,"ไม่พบบิล")

        if bill.shipping_status in LOCK_SHIPPING:
            raise HTTPException(400,f"ไม่สามารถเปลี่ยนสถานะนี้ได้ (ต้องลบบิลเท่านั้น)")
        if new_status and bill.status == "paid" and new_status in ("pending","draft","credit"):
            raise HTTPException(400,"ไม่สามารถย้อนสถานะจาก paid ได้")

        # build log entry — mobile sends a pre-formatted device string, PC sends nothing
        device = payload.get("device", "")
        log_entry = {"at": datetime.now(timezone.utc).isoformat(), "by": device or uid}
        if new_status: log_entry["status"] = f"{bill.status} → {new_status}"
        if new_shipping: log_entry["shipping"] = f"{bill.shipping_status or '-'} → {new_shipping}"
        if scheduled_at: log_entry["scheduled_at"] = scheduled_at
        if ship_note: log_entry["note"] = ship_note
        if ship_photo: log_entry["photo"] = ship_photo
        if ship_report and len(ship_report): log_entry["report"] = ship_report[-1].get("text","")

        existing_log = bill.activity_log or []
        if isinstance(existing_log, str): existing_log = json.loads(existing_log)
        existing_log.append(log_entry)

        sets, params = [], {"id":bid}
        if new_status: sets.append("status=:status"); params["status"]=new_status
        if new_shipping is not None: sets.append("shipping_status=:shipping"); params["shipping"]=new_shipping
        if ship_photo: sets.append("ship_photo_url=:photo"); params["photo"]=ship_photo
        if ship_note is not None: sets.append("ship_note=:snote"); params["snote"]=ship_note
        if ship_report is not None: sets.append("ship_report=:sreport"); params["sreport"]=json.dumps(ship_report)
        if scheduled_at is not None: sets.append("scheduled_at=:sched"); params["sched"]=scheduled_at
        sets.append("activity_log=:alog"); params["alog"]=json.dumps(existing_log)
        if not sets: raise HTTPException(400,"ไม่มีข้อมูลที่จะอัพเดท")
        sets.append("updated_at=NOW()")
        params["tid"] = tid
        c.execute(text(f"UPDATE bills SET {','.join(sets)} WHERE id=:id AND tenant_id=:tid"),params)
        if new_shipping == 'received_payment':
            c.execute(text(
                "UPDATE bills SET status='paid', updated_at=NOW() "
                "WHERE id=:id AND tenant_id=:tid"
            ), {"id": bid, "tid": tid})
            log_entry["status"] = f"{bill.status} → paid (auto: received_payment)"
        if new_status == 'paid_waiting':
            from datetime import timedelta
            sched = payload.get("scheduled_at")
            if not sched:
                sched = (datetime.now(timezone.utc)+timedelta(minutes=15)).isoformat()
            c.execute(text(
                "UPDATE bills SET shipping_status='paid_waiting',"
                "scheduled_at=:sched,updated_at=NOW() "
                "WHERE id=:id AND tenant_id=:tid"
            ), {"sched": sched, "id": bid, "tid": tid})
    return {"ok":True,"bill_id":bid,"log":log_entry}

@router.get("/detail/{bid}")
def get_bill(bid: str, authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.connect() as c:
        r = c.execute(text("SELECT * FROM bills WHERE id=:id AND tenant_id=:tid"),{"id":bid,"tid":tid}).fetchone()
        if not r: raise HTTPException(404,"ไม่พบบิล")
        d = dict(r._mapping)
        if d.get("created_by"):
            cb=d["created_by"]
            s=c.execute(text("SELECT first_name,last_name FROM tenant_staff WHERE id=:id AND tenant_id=:tid"),{"id":cb,"tid":tid}).fetchone()
            if s:
                d["staff_name"]=((s.first_name or "")+" "+(s.last_name or "")).strip()
            else:
                u=c.execute(text("SELECT full_name,email FROM users WHERE id=:id"),{"id":cb}).fetchone()
                if u and u.full_name: d["staff_name"]=u.full_name
                elif u and u.email: d["staff_name"]=u.email.split("@")[0]
                else: d["staff_name"]=cb
        else:
            d["staff_name"]="-"
    return d

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
        if bill.doc_type == "reserve" and bill.status == "pending":
            rv_items = json.loads(bill.items) if isinstance(bill.items,str) else bill.items
            for item in rv_items:
                p = c.execute(text("SELECT track_stock FROM products WHERE id=:id"),{"id":item["id"]}).fetchone()
                if p and p[0]:
                    c.execute(text("UPDATE products SET stock_reserved=GREATEST(0,COALESCE(stock_reserved,0)-:qty),updated_at=NOW() WHERE id=:id"),{"qty":float(item["qty"]),"id":item["id"]})
        elif void_type=="delete_with_return":
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

@router.post("/complete-reserve/{bid}")
def complete_reserve(bid: str, payload: dict = {}, authorization: str = Header("")):
    from datetime import datetime, timezone
    tid, uid = get_tenant_user(authorization)
    with engine.begin() as c:
        bill = c.execute(text("SELECT * FROM bills WHERE id=:id AND tenant_id=:tid"),{"id":bid,"tid":tid}).fetchone()
        if not bill: raise HTTPException(404,"ไม่พบบิล")
        if bill.doc_type != "reserve": raise HTTPException(400,"ไม่ใช่ใบจอง")
        if bill.status != "pending": raise HTTPException(400,f"สถานะ {bill.status} ไม่สามารถจบการขายได้")
        items = json.loads(bill.items) if isinstance(bill.items,str) else bill.items
        for item in items:
            p = c.execute(text("SELECT stock_qty,track_stock,stock_reserved FROM products WHERE id=:id"),{"id":item["id"]}).fetchone()
            if p and p[1]:
                qb=float(p[0] or 0); qa=qb-float(item["qty"])
                qr=max(0,float(p[2] or 0)-float(item["qty"]))
                c.execute(text("UPDATE products SET stock_qty=:q,stock_reserved=:qr,updated_at=NOW() WHERE id=:id"),{"q":qa,"qr":qr,"id":item["id"]})
                c.execute(text("INSERT INTO stock_log(id,tenant_id,product_id,sku,product_name,action,qty_before,qty_change,qty_after,ref_bill_id,ref_bill_no,created_by) VALUES(:id,:tid,:pid,:sku,:name,'reserve_complete',:qb,:qc,:qa,:bid,:bno,:uid)"),
                    {"id":generate_id("slog"),"tid":tid,"pid":item["id"],"sku":item.get("sku",""),"name":item.get("name",""),"qb":qb,"qc":-float(item["qty"]),"qa":qa,"bid":bid,"bno":bill.bill_no,"uid":uid})
        existing_log = bill.activity_log or []
        if isinstance(existing_log,str): existing_log=json.loads(existing_log)
        existing_log.append({"at":datetime.now(timezone.utc).isoformat(),"by":uid,"action":"reserve_complete","status":"pending → paid"})
        pay_method = payload.get("pay_method") or bill.pay_method or "cash"
        paid = float(payload.get("paid") or bill.total or 0)
        c.execute(text("UPDATE bills SET status='paid',doc_type='receipt',pay_method=:pm,paid_amount=:paid,activity_log=:alog,updated_at=NOW() WHERE id=:id"),
            {"pm":pay_method,"paid":paid,"alog":json.dumps(existing_log),"id":bid})
    return {"ok":True,"bill_id":bid,"bill_no":bill.bill_no}

@router.patch("/update-reserve/{bid}")
def update_reserve(bid: str, payload: dict, authorization: str = Header("")):
    tid, uid = get_tenant_user(authorization)
    with engine.begin() as c:
        bill = c.execute(text("SELECT * FROM bills WHERE id=:id AND tenant_id=:tid"),{"id":bid,"tid":tid}).fetchone()
        if not bill: raise HTTPException(404,"ไม่พบบิล")
        if bill.doc_type != "reserve": raise HTTPException(400,"ไม่ใช่ใบจอง")
        if bill.status != "pending": raise HTTPException(400,"ไม่สามารถแก้ไขได้")
        sets, params = [], {"id":bid}
        if "customer" in payload: sets.append("customer_name=:cn"); params["cn"]=payload["customer"]
        if "customer_data" in payload: sets.append("customer_data=:cd"); params["cd"]=json.dumps(payload["customer_data"]) if payload["customer_data"] else None
        if "scheduled_at" in payload: sets.append("scheduled_at=:sched"); params["sched"]=payload["scheduled_at"]
        if "note" in payload: sets.append("note=:note"); params["note"]=payload["note"]
        if "items" in payload:
            new_items = payload["items"]
            old_items = json.loads(bill.items) if isinstance(bill.items,str) else bill.items
            old_map = {i["id"]:float(i["qty"]) for i in old_items}
            new_map = {i["id"]:float(i.get("qty",1)) for i in new_items}
            for pid in set(old_map)|set(new_map):
                delta = new_map.get(pid,0)-old_map.get(pid,0)
                if delta != 0:
                    p = c.execute(text("SELECT track_stock FROM products WHERE id=:id AND tenant_id=:tid"),{"id":pid,"tid":tid}).fetchone()
                    if p and p[0]:
                        if delta > 0:
                            c.execute(text("UPDATE products SET stock_reserved=COALESCE(stock_reserved,0)+:d,updated_at=NOW() WHERE id=:id"),{"d":delta,"id":pid})
                        else:
                            c.execute(text("UPDATE products SET stock_reserved=GREATEST(0,COALESCE(stock_reserved,0)+:d),updated_at=NOW() WHERE id=:id"),{"d":delta,"id":pid})
            sub = sum(float(i.get("qty",1))*float(i.get("price",0)) for i in new_items)
            disc = float(bill.discount or 0); after = max(0,sub-disc)
            vr = int(bill.vat_rate or 0); vat_type = bill.vat_type or "included"
            if vr==0: va=0; total=after
            elif vat_type=="included": va=round(after-after/(1+vr/100),2); total=after
            else: va=round(after*vr/100,2); total=after+va
            sets.append("items=:items"); params["items"]=json.dumps(new_items)
            sets.append("subtotal=:sub"); params["sub"]=sub
            sets.append("vat_amount=:va"); params["va"]=va
            sets.append("total=:total"); params["total"]=total
        if not sets: return {"ok":True}
        sets.append("updated_at=NOW()")
        c.execute(text(f"UPDATE bills SET {','.join(sets)} WHERE id=:id"),params)
    return {"ok":True}

@router.get("/void-log")
def void_log(authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.connect() as c:
        rows = c.execute(text("SELECT id,bill_id,bill_no,void_type,void_reason,total,voided_by,voided_at FROM bill_void_log WHERE tenant_id=:tid ORDER BY voided_at DESC LIMIT 200"),{"tid":tid}).fetchall()
    return [dict(r._mapping) for r in rows]

@router.post("/migrate")
def migrate_bill(payload: dict, authorization: str = Header("")):
    """รับบิลเก่าจาก localStorage มาเก็บใน DB — ต้องตั้ง MIGRATION_MODE=1 ใน env"""
    if not MIGRATION_MODE:
        raise HTTPException(403, "migrate endpoint disabled — set MIGRATION_MODE=1 to enable")
    tid, uid = get_tenant_user(authorization)
    legacy_ref = payload.get("id","")
    # ensure legacy_ref column exists
    with engine.begin() as c:
        c.execute(text("ALTER TABLE bills ADD COLUMN IF NOT EXISTS legacy_ref text"))
    # skip ถ้า legacy_ref นี้ migrate ไปแล้ว
    with engine.connect() as c:
        ex = c.execute(text("SELECT id FROM bills WHERE tenant_id=:tid AND legacy_ref=:ref"),
                       {"tid":tid,"ref":legacy_ref}).fetchone()
        if ex: return {"message":"already exists","legacy_ref":legacy_ref}
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
        bill_no, inv_no, _ = gen_bill_no(tid, c)
        c.execute(text("""
            INSERT INTO bills(id,tenant_id,bill_no,inv_no,doc_type,status,
              customer_name,customer_code,customer_data,items,
              subtotal,discount,discount_type,vat_rate,vat_amount,total,
              pay_method,paid_amount,note,void_reason,legacy_ref,created_by,created_at,updated_at)
            VALUES(:id,:tid,:bno,:ino,:dt,:st,
              :cn,:cc,:cd,:items,
              :sub,:disc,:dtype,:vr,:va,:total,
              :pm,:paid,:note,:voidr,:ref,:uid,:cat,NOW())
        """),{
            "id":bid,"tid":tid,
            "bno":bill_no,"ino":inv_no,
            "dt":payload.get("doc_type","receipt"),
            "st":payload.get("status","paid"),
            "cn":payload.get("customer",""),
            "cc":payload.get("customer_code","") or (payload.get("customer_data") or {}).get("code",""),
            "cd":json.dumps(payload.get("customer_data")) if payload.get("customer_data") else None,
            "items":json.dumps(items),
            "sub":sub,"disc":disc,"dtype":dt,"vr":vr,
            "va":after*vr/100,"total":total,
            "pm":payload.get("pay_method","cash"),
            "paid":float(payload.get("paid",0)),
            "note":payload.get("note",""),
            "voidr":payload.get("void_reason",""),
            "ref":legacy_ref,
            "uid":uid,
            "cat":payload.get("created_at","NOW()")
        })
    return {"message":"migrated","bill_no":bill_no,"legacy_ref":legacy_ref,"id":bid}


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
