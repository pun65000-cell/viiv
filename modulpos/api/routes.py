from fastapi import APIRouter, Header, HTTPException
from sqlalchemy import text
from app.core.db import engine
import jwt, os
from datetime import datetime, date

router = APIRouter(prefix="/api/pos-mobile", tags=["pos-mobile"])
JWT_SECRET = os.getenv("JWT_SECRET", "")

def get_tenant(authorization=""):
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"],
                             options={"leeway":864000,"verify_exp":False})
        tid = payload.get("tenant_id")
        uid = payload.get("sub")
        with engine.connect() as c:
            if not tid and uid:
                u = c.execute(text("SELECT email FROM users WHERE id=:uid LIMIT 1"),{"uid":uid}).fetchone()
                if u:
                    t = c.execute(text("SELECT id FROM tenants WHERE email=:e LIMIT 1"),{"e":u[0]}).fetchone()
                    if t: tid = t[0]
        if not tid: raise HTTPException(status_code=401, detail="Unauthorized")
        return {"tenant_id": tid, "user_id": uid}
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=401, detail=str(e))

@router.get("/summary")
async def summary(authorization: str = Header("")):
    auth = get_tenant(authorization)
    tid = auth["tenant_id"]
    today = date.today().isoformat()
    month = today[:7]
    with engine.connect() as c:
        # ยอดวันนี้
        r = c.execute(text("""
            SELECT COUNT(*) as cnt, COALESCE(SUM(total),0) as total
            FROM bills WHERE tenant_id=:tid
            AND DATE(created_at)=:today AND status!='void'
        """), {"tid":tid,"today":today}).fetchone()
        # ยอดเดือน
        r2 = c.execute(text("""
            SELECT COUNT(*) as cnt, COALESCE(SUM(total),0) as total
            FROM bills WHERE tenant_id=:tid
            AND DATE_TRUNC('month',created_at)=DATE_TRUNC('month',CURRENT_DATE)
            AND status!='void'
        """), {"tid":tid}).fetchone()
        # stock ต่ำ
        r3 = c.execute(text("""
            SELECT COUNT(*) FROM products
            WHERE tenant_id=:tid AND stock_qty <= min_stock AND track_stock=true
        """), {"tid":tid}).fetchone()
    return {
        "today_orders": r[0] if r else 0,
        "today_sales":  float(r[1]) if r else 0,
        "month_orders": r2[0] if r2 else 0,
        "month_sales":  float(r2[1]) if r2 else 0,
        "low_stock":    r3[0] if r3 else 0,
    }

@router.get("/bills/recent")
async def bills_recent(limit: int = 20, authorization: str = Header("")):
    auth = get_tenant(authorization)
    tid = auth["tenant_id"]
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT id, bill_no, total, status, created_at,
                   customer_name, payment_method
            FROM bills WHERE tenant_id=:tid
            ORDER BY created_at DESC LIMIT :limit
        """), {"tid":tid,"limit":limit}).fetchall()
    return {"bills": [dict(r._mapping) for r in rows]}

@router.get("/products/list")
async def products(authorization: str = Header("")):
    auth = get_tenant(authorization)
    tid = auth["tenant_id"]
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT id, name, price, stock_qty, unit,
                   category_id, image_url, is_active
            FROM products WHERE tenant_id=:tid AND is_active=true
            ORDER BY name
        """), {"tid":tid}).fetchall()
    return {"products": [dict(r._mapping) for r in rows]}

@router.get("/members/list")
async def members(q: str = "", authorization: str = Header("")):
    auth = get_tenant(authorization)
    tid = auth["tenant_id"]
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT id, name, phone, email, points, total_spend
            FROM members WHERE tenant_id=:tid
            AND (:q='' OR name ILIKE :qlike OR phone ILIKE :qlike)
            ORDER BY name LIMIT 50
        """), {"tid":tid,"q":q,"qlike":f"%{q}%"}).fetchall()
    return {"members": [dict(r._mapping) for r in rows]}
