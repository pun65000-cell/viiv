"""POS Dashboard summary — aggregated KPIs สำหรับ home cards"""
from fastapi import APIRouter, Header, HTTPException
from sqlalchemy import text
from app.core.db import engine
import jwt, os

router = APIRouter(prefix="/api/pos/dashboard", tags=["pos-dashboard"])
JWT_SECRET = os.getenv("JWT_SECRET", "")


def _tenant_from_token(authorization: str) -> str:
    try:
        token = (authorization or "").replace("Bearer ", "").strip()
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"],
                             options={"leeway": 864000, "verify_exp": False})
        tid = payload.get("tenant_id")
        if tid:
            return tid
    except Exception:
        pass
    raise HTTPException(401, "Unauthorized")


@router.get("/summary")
def dashboard_summary(authorization: str = Header("")):
    tid = _tenant_from_token(authorization)
    with engine.connect() as c:
        # Today: count bills (doc_type=receipt, exclude deleted)
        orders_today = c.execute(text("""
            SELECT COUNT(*) FROM bills
            WHERE tenant_id=:tid
              AND doc_type='receipt'
              AND status <> 'deleted'
              AND DATE(created_at) = CURRENT_DATE
        """), {"tid": tid}).scalar() or 0

        # This month: revenue (paid only) + total receipt count (exclude deleted)
        m = c.execute(text("""
            SELECT
              COALESCE(SUM(CASE WHEN status='paid' THEN total ELSE 0 END), 0) AS revenue,
              COUNT(*) FILTER (WHERE status <> 'deleted') AS orders
            FROM bills
            WHERE tenant_id=:tid
              AND doc_type='receipt'
              AND TO_CHAR(created_at, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
        """), {"tid": tid}).fetchone()

        # Staff online (last_seen within 60 min)
        staff_online = c.execute(text("""
            SELECT COUNT(*) FROM tenant_staff
            WHERE tenant_id=:tid
              AND is_active = TRUE
              AND last_seen > NOW() - INTERVAL '60 minutes'
        """), {"tid": tid}).scalar() or 0

    return {
        "orders_today":   int(orders_today),
        "revenue_month":  float(m.revenue or 0),
        "orders_month":   int(m.orders or 0),
        "staff_online":   int(staff_online),
    }
