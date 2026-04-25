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
                   bs.status, bs.payment_method, bs.due_single, bs.split_pay,
                   bs.created_by, bs.created_at, bs.updated_at, bs.bill_ids, bs.due_dates,
                   bs.cheque_detail, bs.appointment_note, bs.negotiation_note,
                   bs.appointment_dt, bs.partial_amount, bs.slip_url,
                   COALESCE(bs.partner_name, m.name)    AS partner_name,
                   COALESCE(bs.contact_name,  m.name)   AS contact_name,
                   COALESCE(bs.contact_phone, m.phone)  AS contact_phone,
                   COALESCE(bs.partner_address, m.address) AS partner_address,
                   COALESCE(bs.partner_tax_id,  m.tax_id)  AS partner_tax_id,
                   COALESCE(bs.partner_code,    m.code)    AS partner_code,
                   bs.member_id
            FROM billing_statements bs
            LEFT JOIN members m ON m.id = bs.member_id AND m.tenant_id = bs.tenant_id
            WHERE bs.tenant_id=:tid AND bs.status != 'cancelled'
            ORDER BY bs.created_at DESC LIMIT 100
        """), {"tid": tid}).fetchall()
    result = []
    for r in rows:
        result.append({
            "id": r[0], "run_id": r[1],
            "total_amt": float(r[2] or 0), "discount": float(r[3] or 0),
            "vat_amt": float(r[4] or 0), "net_amt": float(r[5] or 0),
            "status": r[6], "payment_method": r[7],
            "due_single": str(r[8]) if r[8] else None,
            "split_pay": r[9], "created_by": r[10],
            "created_at": str(r[11]), "updated_at": str(r[12]),
            "bill_ids": r[13] if isinstance(r[13], list) else json.loads(r[13] or "[]"),
            "due_dates": r[14] if isinstance(r[14], list) else json.loads(r[14] or "[]"),
            "cheque_detail": r[15],
            "appointment_note": r[16],
            "negotiation_note": r[17],
            "appointment_dt": str(r[18]) if r[18] else None,
            "partial_amount": float(r[19]) if r[19] else None,
            "slip_url": r[20],
            "partner_name": r[21],
            "contact_name": r[22],
            "contact_phone": r[23],
            "partner_address": r[24],
            "partner_tax_id": r[25],
            "partner_code": r[26],
            "member_id": r[27],
        })
    return result

@router.get("/unpaid-bills")
def unpaid_bills(member_id: str = Query(""), authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.connect() as c:
        if member_id:
            rows = c.execute(text("""
                SELECT b.id, b.bill_no, b.customer_name, b.total, b.pay_method,
                       b.doc_type, b.created_at, b.shipping_status
                FROM bills b
                WHERE b.tenant_id=:tid
                  AND b.customer_id=:mid
                  AND b.status NOT IN ('paid','void','cancelled')
                  AND b.doc_type IN ('invoice','receipt')
                  AND NOT EXISTS (
                    SELECT 1 FROM billing_statements bs2
                    WHERE bs2.tenant_id=:tid
                      AND bs2.status != 'cancelled'
                      AND bs2.bill_ids IS NOT NULL
                      AND bs2.bill_ids != '[]'
                      AND bs2.bill_ids::jsonb @> jsonb_build_array(b.id::text)
                  )
                ORDER BY b.created_at DESC LIMIT 200
            """), {"tid": tid, "mid": member_id}).fetchall()
        else:
            rows = c.execute(text("""
                SELECT id, bill_no, customer_name, total, pay_method,
                       doc_type, created_at, shipping_status
                FROM bills
                WHERE tenant_id=:tid
                  AND status NOT IN ('paid','void','cancelled')
                  AND doc_type IN ('invoice','receipt')
                ORDER BY created_at DESC LIMIT 200
            """), {"tid": tid}).fetchall()
    result = []
    for r in rows:
        result.append({
            "id": r[0], "bill_no": r[1], "customer_name": r[2],
            "total": float(r[3] or 0), "pay_method": r[4],
            "doc_type": r[5], "created_at": str(r[6]),
            "shipping_status": r[7],
        })
    return result

@router.post("/create")
def create_statement(payload: dict, authorization: str = Header("")):
    tid, uid = get_tenant_user(authorization)
    bill_ids = payload.get("bill_ids", [])
    if not bill_ids:
        raise HTTPException(400, "กรุณาเลือกบิลอย่างน้อย 1 รายการ")
    total_amt = float(payload.get("total_amt", 0))
    discount  = float(payload.get("discount", 0))
    vat_type  = payload.get("vat_type", "included")
    vat_rate  = float(payload.get("vat_rate", 0))
    after_disc = max(0, total_amt - discount)
    if vat_rate == 0:
        vat_amt = 0; net_amt = after_disc
    elif vat_type == "included":
        vat_amt = round(after_disc - after_disc / (1 + vat_rate/100), 2)
        net_amt = after_disc
    else:
        vat_amt = round(after_disc * vat_rate / 100, 2)
        net_amt = after_disc + vat_amt
    # Member snapshot
    member_id = payload.get("member_id") or None
    partner_name = contact_name = contact_phone = None
    partner_address = partner_tax_id = partner_code = None
    if member_id:
        with engine.connect() as c:
            m = c.execute(text(
                "SELECT name, name, phone, address, tax_id, code "
                "FROM members WHERE id=:mid AND tenant_id=:tid LIMIT 1"
            ), {"mid": member_id, "tid": tid}).fetchone()
            if m:
                partner_name, contact_name, contact_phone = m[0], m[1], m[2]
                partner_address, partner_tax_id, partner_code = m[3], m[4], m[5]
    with engine.begin() as c:
        run_id = gen_run_id(tid, c)
        c.execute(text("""
            INSERT INTO billing_statements (
                run_id, tenant_id, bill_ids, total_amt, discount,
                vat_amt, vat_type, net_amt, due_dates, due_single,
                split_pay, status, payment_method, slip_url,
                cheque_detail, appointment_note, created_by,
                member_id, partner_name, contact_name, contact_phone,
                partner_address, partner_tax_id, partner_code
            ) VALUES (
                :run_id, :tid, :bill_ids, :total_amt, :discount,
                :vat_amt, :vat_type, :net_amt, :due_dates, :due_single,
                :split_pay, 'pending', :pm, :slip, :cheque, :appt, :uid,
                :mid, :pname, :cname, :cphone, :paddr, :ptaxid, :pcode
            )
        """), {
            "run_id": run_id, "tid": tid,
            "bill_ids": json.dumps(bill_ids),
            "total_amt": total_amt, "discount": discount,
            "vat_amt": vat_amt, "vat_type": vat_type, "net_amt": net_amt,
            "due_dates": json.dumps(payload.get("due_dates", [])),
            "due_single": payload.get("due_single"),
            "split_pay": bool(payload.get("split_pay", False)),
            "pm": payload.get("payment_method"),
            "slip": payload.get("slip_url"),
            "cheque": payload.get("cheque_detail"),
            "appt": payload.get("appointment_note"),
            "uid": uid,
            "mid": member_id,
            "pname": partner_name, "cname": contact_name, "cphone": contact_phone,
            "paddr": partner_address, "ptaxid": partner_tax_id, "pcode": partner_code,
        })
    return {"ok": True, "run_id": run_id}

@router.patch("/record/{sid}")
def record_statement(sid: int, payload: dict, authorization: str = Header("")):
    tid, uid = get_tenant_user(authorization)
    with engine.begin() as c:
        row = c.execute(text(
            "SELECT id FROM billing_statements WHERE id=:id AND tenant_id=:tid"
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
            f"SELECT id::text, bill_no, customer_name, total, created_at "
            f"FROM bills WHERE id::text IN ({','.join(placeholders)}) AND tenant_id=:tid"
        ), params).fetchall()
    return [{"id": r[0], "bill_no": r[1], "customer_name": r[2],
             "total": float(r[3] or 0), "created_at": str(r[4])} for r in rows]

@router.delete("/{sid}")
def delete_statement(sid: int, authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.begin() as c:
        row = c.execute(text(
            "SELECT id FROM billing_statements WHERE id=:id AND tenant_id=:tid"
        ), {"id": sid, "tid": tid}).fetchone()
        if not row:
            raise HTTPException(404, "ไม่พบรายการ")
        c.execute(text(
            "UPDATE billing_statements SET status='cancelled', updated_at=NOW() WHERE id=:id AND tenant_id=:tid"
        ), {"id": sid, "tid": tid})
    return {"ok": True}
