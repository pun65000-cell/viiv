import os, uuid, time, random, string
from datetime import datetime, timezone, date
from fastapi import APIRouter, Header, HTTPException, UploadFile, File
from sqlalchemy import text
from app.core.db import engine
import jwt

router = APIRouter(prefix="/api/pos/finance", tags=["pos-finance"])
JWT_SECRET = os.getenv("JWT_SECRET", "")
UPLOAD_DIR = "/home/viivadmin/viiv/uploads/finance"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ─── CREATE TABLES IF NOT EXISTS ───────────────────────────────
with engine.begin() as _c:
    _c.execute(text("""
        CREATE TABLE IF NOT EXISTS finance_income (
            id          text PRIMARY KEY,
            tenant_id   text NOT NULL,
            source      text,
            pay_type    text,
            amount      numeric(12,2) NOT NULL DEFAULT 0,
            slip_url    text,
            noted_by    text,
            txn_at      timestamptz NOT NULL DEFAULT NOW(),
            created_at  timestamptz NOT NULL DEFAULT NOW()
        )
    """))
    _c.execute(text("""
        CREATE TABLE IF NOT EXISTS finance_expense (
            id          text PRIMARY KEY,
            tenant_id   text NOT NULL,
            partner_id  text,
            source      text,
            pay_type    text,
            amount      numeric(12,2) NOT NULL DEFAULT 0,
            slip_url    text,
            noted_by    text,
            txn_at      timestamptz NOT NULL DEFAULT NOW(),
            created_at  timestamptz NOT NULL DEFAULT NOW()
        )
    """))
    _c.execute(text("CREATE INDEX IF NOT EXISTS idx_fin_inc_tid ON finance_income(tenant_id, txn_at DESC)"))
    _c.execute(text("CREATE INDEX IF NOT EXISTS idx_fin_exp_tid ON finance_expense(tenant_id, txn_at DESC)"))

# ─── HELPERS ───────────────────────────────────────────────────
def get_tenant_user(authorization=""):
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"], options={"leeway": 864000, "verify_exp": False})
        uid = payload.get("sub"); tid = payload.get("tenant_id")
        with engine.connect() as c:
            if not tid and uid:
                u = c.execute(text("SELECT email FROM users WHERE id=:uid LIMIT 1"), {"uid": uid}).fetchone()
                if u:
                    t = c.execute(text("SELECT id FROM tenants WHERE email=:e LIMIT 1"), {"e": u[0]}).fetchone()
                    if t: tid = t[0]
            if not tid and payload.get("role") == "admin":
                t = c.execute(text("SELECT id FROM tenants ORDER BY created_at LIMIT 1")).fetchone()
                if t: tid = t[0]
        if tid: return tid, uid or "unknown"
    except: pass
    raise HTTPException(401)

def gen_id(prefix="fin"):
    return prefix + "_" + str(int(time.time())) + "_" + "".join(random.choices(string.ascii_lowercase + string.digits, k=4))

def _parse_month(month_str: str):
    """MM-YYYY → (year:int, month:int)"""
    try:
        parts = month_str.split("-")
        if len(parts) == 2:
            return int(parts[1]), int(parts[0])
    except: pass
    now = datetime.now()
    return now.year, now.month

# ─── 1. SUMMARY ────────────────────────────────────────────────
@router.get("/summary")
def get_summary(month: str = "", authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    year, mon = _parse_month(month)

    with engine.connect() as c:
        sales_row = c.execute(text("""
            SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS cnt
            FROM bills
            WHERE tenant_id=:tid
              AND status IN ('paid','transfer_paid','partial','paid_waiting','transfer_waiting')
              AND EXTRACT(YEAR FROM created_at)=:yr
              AND EXTRACT(MONTH FROM created_at)=:mo
        """), {"tid": tid, "yr": year, "mo": mon}).fetchone()

        inc_row = c.execute(text("""
            SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS cnt
            FROM finance_income
            WHERE tenant_id=:tid
              AND EXTRACT(YEAR FROM txn_at)=:yr AND EXTRACT(MONTH FROM txn_at)=:mo
        """), {"tid": tid, "yr": year, "mo": mon}).fetchone()

        exp_row = c.execute(text("""
            SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS cnt
            FROM finance_expense
            WHERE tenant_id=:tid
              AND EXTRACT(YEAR FROM txn_at)=:yr AND EXTRACT(MONTH FROM txn_at)=:mo
        """), {"tid": tid, "yr": year, "mo": mon}).fetchone()

        daily_sales = c.execute(text("""
            SELECT DATE(created_at AT TIME ZONE 'Asia/Bangkok') AS day,
                   COALESCE(SUM(total),0) AS total
            FROM bills
            WHERE tenant_id=:tid
              AND status IN ('paid','transfer_paid','partial','paid_waiting','transfer_waiting')
              AND EXTRACT(YEAR FROM created_at)=:yr AND EXTRACT(MONTH FROM created_at)=:mo
            GROUP BY day ORDER BY day
        """), {"tid": tid, "yr": year, "mo": mon}).fetchall()

        daily_inc = c.execute(text("""
            SELECT DATE(txn_at AT TIME ZONE 'Asia/Bangkok') AS day,
                   COALESCE(SUM(amount),0) AS total
            FROM finance_income
            WHERE tenant_id=:tid
              AND EXTRACT(YEAR FROM txn_at)=:yr AND EXTRACT(MONTH FROM txn_at)=:mo
            GROUP BY day ORDER BY day
        """), {"tid": tid, "yr": year, "mo": mon}).fetchall()

        daily_exp = c.execute(text("""
            SELECT DATE(txn_at AT TIME ZONE 'Asia/Bangkok') AS day,
                   COALESCE(SUM(amount),0) AS total
            FROM finance_expense
            WHERE tenant_id=:tid
              AND EXTRACT(YEAR FROM txn_at)=:yr AND EXTRACT(MONTH FROM txn_at)=:mo
            GROUP BY day ORDER BY day
        """), {"tid": tid, "yr": year, "mo": mon}).fetchall()

        today_str = date.today().isoformat()
        today_sales = c.execute(text("""
            SELECT COALESCE(SUM(total),0) FROM bills
            WHERE tenant_id=:tid
              AND status IN ('paid','transfer_paid','partial','paid_waiting','transfer_waiting')
              AND DATE(created_at AT TIME ZONE 'Asia/Bangkok')=:td
        """), {"tid": tid, "td": today_str}).scalar()

        today_inc = c.execute(text("""
            SELECT COALESCE(SUM(amount),0) FROM finance_income
            WHERE tenant_id=:tid AND DATE(txn_at AT TIME ZONE 'Asia/Bangkok')=:td
        """), {"tid": tid, "td": today_str}).scalar()

        today_exp = c.execute(text("""
            SELECT COALESCE(SUM(amount),0) FROM finance_expense
            WHERE tenant_id=:tid AND DATE(txn_at AT TIME ZONE 'Asia/Bangkok')=:td
        """), {"tid": tid, "td": today_str}).scalar()

    daily_map: dict = {}
    for r in daily_sales:
        k = str(r.day)
        daily_map.setdefault(k, {"date": k, "sales": 0, "income": 0, "expense": 0})["sales"] = float(r.total)
    for r in daily_inc:
        k = str(r.day)
        daily_map.setdefault(k, {"date": k, "sales": 0, "income": 0, "expense": 0})["income"] = float(r.total)
    for r in daily_exp:
        k = str(r.day)
        daily_map.setdefault(k, {"date": k, "sales": 0, "income": 0, "expense": 0})["expense"] = float(r.total)
    daily = sorted(daily_map.values(), key=lambda x: x["date"])

    s_total = float(sales_row.total)
    i_total = float(inc_row.total)
    e_total = float(exp_row.total)

    return {
        "month": f"{mon:02d}-{year}",
        "sales":   {"total": s_total, "count": int(sales_row.cnt)},
        "income":  {"total": i_total, "count": int(inc_row.cnt)},
        "expense": {"total": e_total, "count": int(exp_row.cnt)},
        "net": s_total + i_total - e_total,
        "daily": daily,
        "today": {
            "sales":   float(today_sales or 0),
            "income":  float(today_inc or 0),
            "expense": float(today_exp or 0),
        },
    }

# ─── 2. LIST INCOME ────────────────────────────────────────────
@router.get("/income")
def list_income(q: str = "", limit: int = 100, authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    cap = min(max(1, limit), 500)
    filters = "WHERE tenant_id=:tid"
    params: dict = {"tid": tid}
    if q:
        filters += " AND (source ILIKE :q OR noted_by ILIKE :q OR pay_type ILIKE :q)"
        params["q"] = f"%{q}%"
    with engine.connect() as c:
        rows = c.execute(text(
            f"SELECT * FROM finance_income {filters} ORDER BY txn_at DESC LIMIT {cap}"
        ), params).fetchall()
    return {"income": [dict(r._mapping) for r in rows]}

# ─── 3. LIST EXPENSE ───────────────────────────────────────────
@router.get("/expense")
def list_expense(q: str = "", limit: int = 100, authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    cap = min(max(1, limit), 500)
    filters = "WHERE e.tenant_id=:tid"
    params: dict = {"tid": tid}
    if q:
        filters += " AND (e.source ILIKE :q OR e.noted_by ILIKE :q OR e.pay_type ILIKE :q OR p.name ILIKE :q)"
        params["q"] = f"%{q}%"
    with engine.connect() as c:
        rows = c.execute(text(f"""
            SELECT e.*, p.name AS partner_name
            FROM finance_expense e
            LEFT JOIN partners p ON p.id = e.partner_id AND p.tenant_id = e.tenant_id
            {filters}
            ORDER BY e.txn_at DESC LIMIT {cap}
        """), params).fetchall()
    return {"expense": [dict(r._mapping) for r in rows]}

# ─── 4. CREATE INCOME ──────────────────────────────────────────
@router.post("/income")
def create_income(payload: dict, authorization: str = Header("")):
    tid, uid = get_tenant_user(authorization)
    amount = float(payload.get("amount") or 0)
    if amount <= 0:
        raise HTTPException(400, "amount ต้องมากกว่า 0")
    fid = gen_id("fin_inc")
    txn_at = payload.get("txn_at") or datetime.now(timezone.utc).isoformat()
    with engine.begin() as c:
        c.execute(text("""
            INSERT INTO finance_income(id, tenant_id, source, pay_type, amount, noted_by, txn_at, created_at)
            VALUES(:id, :tid, :src, :ptype, :amt, :nb, :at, NOW())
        """), {
            "id": fid, "tid": tid,
            "src":   payload.get("source", ""),
            "ptype": payload.get("pay_type", ""),
            "amt":   amount,
            "nb":    payload.get("noted_by", uid),
            "at":    txn_at,
        })
    return {"id": fid, "message": "บันทึกรายรับสำเร็จ"}

# ─── 5. CREATE EXPENSE ─────────────────────────────────────────
@router.post("/expense")
def create_expense(payload: dict, authorization: str = Header("")):
    tid, uid = get_tenant_user(authorization)
    amount = float(payload.get("amount") or 0)
    if amount <= 0:
        raise HTTPException(400, "amount ต้องมากกว่า 0")
    source = payload.get("source", "").strip()
    partner_id = payload.get("partner_id", "")
    if not source and not partner_id:
        raise HTTPException(400, "ต้องระบุ source หรือ partner_id")
    fid = gen_id("fin_exp")
    txn_at = payload.get("txn_at") or datetime.now(timezone.utc).isoformat()
    with engine.begin() as c:
        c.execute(text("""
            INSERT INTO finance_expense(id, tenant_id, partner_id, source, pay_type, amount, noted_by, txn_at, created_at)
            VALUES(:id, :tid, :pid, :src, :ptype, :amt, :nb, :at, NOW())
        """), {
            "id": fid, "tid": tid,
            "pid":   partner_id or None,
            "src":   source,
            "ptype": payload.get("pay_type", ""),
            "amt":   amount,
            "nb":    payload.get("noted_by", uid),
            "at":    txn_at,
        })
    return {"id": fid, "message": "บันทึกรายจ่ายสำเร็จ"}

# ─── 6. DELETE INCOME ──────────────────────────────────────────
@router.delete("/income/{fid}")
def delete_income(fid: str, authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.begin() as c:
        r = c.execute(text("DELETE FROM finance_income WHERE id=:id AND tenant_id=:tid"), {"id": fid, "tid": tid})
        if r.rowcount == 0:
            raise HTTPException(404, "ไม่พบรายการ")
    return {"message": "ลบสำเร็จ"}

# ─── 7. DELETE EXPENSE ─────────────────────────────────────────
@router.delete("/expense/{fid}")
def delete_expense(fid: str, authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.begin() as c:
        r = c.execute(text("DELETE FROM finance_expense WHERE id=:id AND tenant_id=:tid"), {"id": fid, "tid": tid})
        if r.rowcount == 0:
            raise HTTPException(404, "ไม่พบรายการ")
    return {"message": "ลบสำเร็จ"}

# ─── 8. UPLOAD SLIP ────────────────────────────────────────────
@router.post("/upload-slip/{entry_type}/{fid}")
async def upload_slip(entry_type: str, fid: str, file: UploadFile = File(...), authorization: str = Header("")):
    if entry_type not in ("income", "expense"):
        raise HTTPException(400, "entry_type ต้องเป็น income หรือ expense")
    tid, _ = get_tenant_user(authorization)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "ไฟล์ใหญ่เกิน 10MB")
    ext = os.path.splitext(file.filename or "slip.jpg")[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".pdf"):
        raise HTTPException(400, "รองรับเฉพาะ JPG/PNG/WEBP/PDF")
    dest_dir = os.path.join(UPLOAD_DIR, tid)
    os.makedirs(dest_dir, exist_ok=True)
    fname = str(uuid.uuid4()) + ext
    with open(os.path.join(dest_dir, fname), "wb") as f:
        f.write(content)
    url = f"/uploads/finance/{tid}/{fname}"
    table = "finance_income" if entry_type == "income" else "finance_expense"
    with engine.begin() as c:
        r = c.execute(text(f"UPDATE {table} SET slip_url=:url WHERE id=:id AND tenant_id=:tid"),
                      {"url": url, "id": fid, "tid": tid})
        if r.rowcount == 0:
            raise HTTPException(404, "ไม่พบรายการ")
    return {"url": url}
