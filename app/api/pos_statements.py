from fastapi import APIRouter, Header, HTTPException
from sqlalchemy import text
from app.core.db import engine
import jwt, os, json
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
            SELECT id, run_id, total_amt, discount, vat_amt, net_amt,
                   status, payment_method, due_single, split_pay,
                   created_by, created_at, updated_at, bill_ids, due_dates
            FROM billing_statements
            WHERE tenant_id=:tid AND status != 'cancelled'
            ORDER BY created_at DESC LIMIT 100
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
        })
    return result

@router.get("/unpaid-bills")
def unpaid_bills(authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.connect() as c:
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
    with engine.begin() as c:
        run_id = gen_run_id(tid, c)
        c.execute(text("""
            INSERT INTO billing_statements (
                run_id, tenant_id, bill_ids, total_amt, discount,
                vat_amt, vat_type, net_amt, due_dates, due_single,
                split_pay, status, payment_method, slip_url,
                cheque_detail, appointment_note, created_by
            ) VALUES (
                :run_id, :tid, :bill_ids, :total_amt, :discount,
                :vat_amt, :vat_type, :net_amt, :due_dates, :due_single,
                :split_pay, 'pending', :pm, :slip, :cheque, :appt, :uid
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
        c.execute(text("""
            UPDATE billing_statements SET
                status=COALESCE(:status, status),
                payment_method=COALESCE(:pm, payment_method),
                slip_url=COALESCE(:slip, slip_url),
                cheque_detail=COALESCE(:cheque, cheque_detail),
                appointment_note=COALESCE(:appt, appointment_note),
                recorded_by=:uid, updated_at=NOW()
            WHERE id=:id AND tenant_id=:tid
        """), {
            "status": payload.get("status"),
            "pm": payload.get("payment_method"),
            "slip": payload.get("slip_url"),
            "cheque": payload.get("cheque_detail"),
            "appt": payload.get("appointment_note"),
            "uid": uid, "id": sid, "tid": tid,
        })
    return {"ok": True}

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
