from fastapi import APIRouter, Header, HTTPException, UploadFile, File, Query
from sqlalchemy import text
from app.core.db import engine
import jwt, os, json, shutil, uuid
from datetime import datetime

router = APIRouter(prefix="/api/pos/statements", tags=["pos-statements"])
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

def gen_run_id(tid, conn):
    date_str = datetime.now().strftime("%Y%m%d")
    prefix = f"BS-{tid}-{date_str}"
    row = conn.execute(text(
        "SELECT COUNT(*) FROM billing_statements WHERE run_id LIKE :p AND tenant_id=:tid"
    ), {"p": f"{prefix}%", "tid": tid}).fetchone()
    seq = (row[0] if row else 0) + 1
    return f"{prefix}-{str(seq).zfill(3)}"

@router.get("/list")
def list_statements(authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT bs.id, bs.run_id, bs.total_amt, bs.discount, bs.vat_amt, bs.net_amt,
                   bs.status, bs.payment_method, bs.due_single,
                   bs.created_by, bs.created_at, bs.bill_ids,
                   bs.cheque_detail, bs.appointment_note, bs.negotiation_note,
                   bs.appointment_dt, bs.partial_amount, bs.slip_url,
                   (SELECT b.customer_name FROM bills b
                    WHERE b.id::text = (bs.bill_ids::jsonb ->> 0) LIMIT 1) AS customer_name,
                   (SELECT b.customer_code FROM bills b
                    WHERE b.id::text = (bs.bill_ids::jsonb ->> 0) LIMIT 1) AS customer_code,
                   (SELECT b.customer_data FROM bills b
                    WHERE b.id::text = (bs.bill_ids::jsonb ->> 0) LIMIT 1) AS customer_data
            FROM billing_statements bs
            WHERE bs.tenant_id=:tid AND bs.status != 'cancelled'
            ORDER BY bs.created_at DESC LIMIT 100
        """), {"tid": tid}).fetchall()
    result = []
    for r in rows:
        cd = {}
        try:
            cd = json.loads(r[20] or "{}") if isinstance(r[20], str) else (r[20] or {})
        except: pass
        result.append({
            "id": r[0], "run_id": r[1],
            "total_amt": float(r[2] or 0), "discount": float(r[3] or 0),
            "vat_amt": float(r[4] or 0), "net_amt": float(r[5] or 0),
            "status": r[6], "payment_method": r[7],
            "due_single": str(r[8]) if r[8] else None,
            "created_by": r[9], "created_at": str(r[10]),
            "bill_ids": r[11] if isinstance(r[11], list) else json.loads(r[11] or "[]"),
            "cheque_detail": r[12],
            "appointment_note": r[13],
            "negotiation_note": r[14],
            "appointment_dt": str(r[15]) if r[15] else None,
            "partial_amount": float(r[16]) if r[16] else None,
            "slip_url": r[17],
            "customer_name": r[18] or cd.get("name", ""),
            "customer_code": r[19] or cd.get("code", ""),
            "customer_data": cd,
            "customer_phone": cd.get("phone", ""),
            "customer_address": cd.get("address", ""),
            "customer_tax_id": cd.get("tax_id", ""),
        })
    return result

@router.get("/unpaid-bills")
def unpaid_bills(q: str = Query(""), authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    has_q = bool(q.strip())
    with engine.connect() as c:
        q_filter = "AND (b.customer_name ILIKE :qp OR b.bill_no ILIKE :qp OR b.customer_code ILIKE :qp)" if has_q else ""
        rows = c.execute(text(f"""
            SELECT b.id, b.bill_no, b.customer_id, b.customer_name,
                   b.customer_code, b.total, b.created_at,
                   m.phone, m.address, m.tax_id
            FROM bills b
            LEFT JOIN members m ON b.customer_id = m.id::text
            WHERE b.tenant_id = :tid
              AND b.status NOT IN ('paid','voided','deleted','draft')
              AND (b.shipping_status IS NULL OR b.shipping_status != 'received_payment')
              {q_filter}
              AND b.id::text NOT IN (
                SELECT jsonb_array_elements_text(bs2.bill_ids)
                FROM billing_statements bs2
                WHERE bs2.tenant_id = :tid
                  AND bs2.status != 'cancelled'
                  AND bs2.bill_ids IS NOT NULL
                  AND bs2.bill_ids != '[]'::jsonb
              )
            ORDER BY b.created_at DESC LIMIT 50
        """), {"tid": tid, "qp": f"%{q}%"}).fetchall()
    result = []
    for r in rows:
        result.append({
            "id": str(r[0]), "bill_no": r[1],
            "customer_id": str(r[2]) if r[2] else None,
            "customer_name": r[3], "customer_code": r[4],
            "total": float(r[5] or 0), "created_at": str(r[6]),
            "customer_phone": r[7] or "",
            "customer_address": r[8] or "",
            "customer_tax_id": r[9] or "",
        })
    return result

@router.get("/by-bill/{bid}")
def statement_by_bill(bid: str, authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.connect() as c:
        row = c.execute(text("""
            SELECT run_id, created_by, created_at
            FROM billing_statements
            WHERE tenant_id=:tid
              AND bill_ids @> jsonb_build_array(:bid)
              AND status != 'cancelled'
            LIMIT 1
        """), {"tid": tid, "bid": bid}).fetchone()
    if not row:
        return {}
    return {"run_id": row[0], "created_by": row[1], "created_at": str(row[2])}

@router.post("/create")
def create_statement(payload: dict, authorization: str = Header("")):
    tid, uid = get_tenant_user(authorization)
    bill_ids = payload.get("bill_ids", [])
    if not bill_ids:
        raise HTTPException(400, "กรุณาเลือกบิลอย่างน้อย 1 รายการ")
    if not payload.get("due_single"):
        raise HTTPException(400, "กรุณาระบุวันกำหนดชำระ")
    total_amt = float(payload.get("total_amt", 0))
    discount  = float(payload.get("discount", 0))
    vat_type  = payload.get("vat_type", "none")
    vat_rate  = float(payload.get("vat_rate", 0))
    after_disc = max(0, total_amt - discount)
    if vat_rate == 0 or vat_type == "none":
        vat_amt = 0; net_amt = after_disc
    elif vat_type == "included":
        vat_amt = round(after_disc - after_disc / (1 + vat_rate/100), 2)
        net_amt = after_disc
    else:
        vat_amt = round(after_disc * vat_rate / 100, 2)
        net_amt = after_disc + vat_amt
    with engine.begin() as c:
        run_id = gen_run_id(tid, c)
        c.execute(text("""
            INSERT INTO billing_statements (
                run_id, tenant_id, bill_ids, total_amt, discount,
                vat_amt, vat_type, net_amt, due_dates, due_single,
                split_pay, status, created_by
            ) VALUES (
                :run_id, :tid, :bill_ids, :total_amt, :discount,
                :vat_amt, :vat_type, :net_amt, '[]', :due_single,
                false, 'pending', :uid
            )
        """), {
            "run_id": run_id, "tid": tid,
            "bill_ids": json.dumps([str(b) for b in bill_ids]),
            "total_amt": total_amt, "discount": discount,
            "vat_amt": vat_amt, "vat_type": vat_type, "net_amt": net_amt,
            "due_single": payload.get("due_single"),
            "uid": uid,
        })
    return {"ok": True, "run_id": run_id}

@router.patch("/record/{sid}")
def record_statement(sid: int, payload: dict, authorization: str = Header("")):
    tid, uid = get_tenant_user(authorization)
    with engine.begin() as c:
        row = c.execute(text(
            "SELECT id, bill_ids FROM billing_statements WHERE id=:id AND tenant_id=:tid"
        ), {"id": sid, "tid": tid}).fetchone()
        if not row:
            raise HTTPException(404, "ไม่พบรายการ")
        cheque = payload.get("cheque_detail")
        if isinstance(cheque, dict):
            cheque = json.dumps(cheque)
        c.execute(text("""
            UPDATE billing_statements SET
                status=COALESCE(:status, status),
                payment_method=COALESCE(:pm, payment_method),
                slip_url=COALESCE(:slip, slip_url),
                cheque_detail=COALESCE(:cheque, cheque_detail),
                appointment_note=COALESCE(:appt, appointment_note),
                negotiation_note=COALESCE(:neg, negotiation_note),
                appointment_dt=COALESCE(:appt_dt::timestamptz, appointment_dt),
                due_single=COALESCE(:due, due_single),
                partial_amount=COALESCE(:partial, partial_amount),
                recorded_by=:uid, updated_at=NOW()
            WHERE id=:id AND tenant_id=:tid
        """), {
            "status": payload.get("status"),
            "pm": payload.get("payment_method"),
            "slip": payload.get("slip_url"),
            "cheque": cheque,
            "appt": payload.get("appointment_note"),
            "neg": payload.get("negotiation_note"),
            "appt_dt": payload.get("appointment_dt"),
            "due": payload.get("due_single"),
            "partial": payload.get("partial_amount"),
            "uid": uid, "id": sid, "tid": tid,
        })
        if payload.get("status") == "paid":
            bill_ids = row[1] if isinstance(row[1], list) else json.loads(row[1] or "[]")
            for bid in bill_ids:
                c.execute(text(
                    "UPDATE bills SET status='paid', updated_at=NOW() "
                    "WHERE id::text=:bid AND tenant_id=:tid"
                ), {"bid": str(bid), "tid": tid})
    return {"ok": True}

@router.post("/upload-slip/{sid}")
async def upload_slip(sid: int, file: UploadFile = File(...), authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.connect() as c:
        row = c.execute(text(
            "SELECT id FROM billing_statements WHERE id=:id AND tenant_id=:tid"
        ), {"id": sid, "tid": tid}).fetchone()
        if not row:
            raise HTTPException(404, "ไม่พบรายการ")
    ext = os.path.splitext(file.filename or "")[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    dirpath = f"uploads/statements/{tid}"
    os.makedirs(dirpath, exist_ok=True)
    filepath = f"{dirpath}/{filename}"
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    slip_url = f"/uploads/statements/{tid}/{filename}"
    with engine.begin() as c:
        c.execute(text(
            "UPDATE billing_statements SET slip_url=:url, updated_at=NOW() WHERE id=:id AND tenant_id=:tid"
        ), {"url": slip_url, "id": sid, "tid": tid})
    return {"slip_url": slip_url}

@router.get("/{sid}/bills")
def statement_bills(sid: int, authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.connect() as c:
        row = c.execute(text(
            "SELECT bill_ids FROM billing_statements WHERE id=:id AND tenant_id=:tid"
        ), {"id": sid, "tid": tid}).fetchone()
        if not row:
            raise HTTPException(404, "ไม่พบรายการ")
        bill_ids = row[0] if isinstance(row[0], list) else json.loads(row[0] or "[]")
        if not bill_ids:
            return []
        params = {"tid": tid}
        placeholders = []
        for i, bid in enumerate(bill_ids):
            k = f"b{i}"
            params[k] = str(bid)
            placeholders.append(f":{k}")
        rows = c.execute(text(
            f"SELECT id::text, bill_no, customer_name, customer_code, customer_data::text, total, created_at "
            f"FROM bills WHERE id::text IN ({','.join(placeholders)}) AND tenant_id=:tid"
        ), params).fetchall()
    result = []
    for r in rows:
        cd = {}
        try:
            cd = json.loads(r[4] or "{}") if isinstance(r[4], str) else (r[4] or {})
        except: pass
        result.append({
            "id": r[0], "bill_no": r[1], "customer_name": r[2],
            "customer_code": r[3], "customer_data": cd,
            "total": float(r[5] or 0), "created_at": str(r[6])
        })
    return result

@router.delete("/{sid}")
def delete_statement(sid: int, authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.begin() as c:
        row = c.execute(text(
            "SELECT id, bill_ids FROM billing_statements WHERE id=:id AND tenant_id=:tid"
        ), {"id": sid, "tid": tid}).fetchone()
        if not row:
            raise HTTPException(404, "ไม่พบรายการ")
        c.execute(text(
            "UPDATE billing_statements SET status='cancelled', updated_at=NOW() WHERE id=:id AND tenant_id=:tid"
        ), {"id": sid, "tid": tid})
    return {"ok": True}
