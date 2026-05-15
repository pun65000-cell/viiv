"""Public (no-auth) endpoints for landing page consumption."""
from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from app.core.db import engine

router = APIRouter(prefix="/api/public", tags=["public"])

@router.get("/payment-info")
def get_payment_info():
    with engine.connect() as c:
        row = c.execute(text("""
            SELECT bank_code, bank_name, account_no, account_name,
                   branch, qr_url, is_default
            FROM platform_bank_accounts
            WHERE is_active = true
              AND feature_visible = true
            ORDER BY is_default DESC, sort_order ASC, created_at DESC
            LIMIT 1
        """)).mappings().first()
    if not row:
        raise HTTPException(
            status_code=503,
            detail="ระบบชำระเงินกำลังปรับปรุง กรุณาติดต่อ Line OA: @004krtts"
        )
    return {
        "account": {
            "bank_code":    row["bank_code"],
            "bank_name":    row["bank_name"],
            "account_no":   row["account_no"],
            "account_name": row["account_name"],
            "branch":       row["branch"],
            "qr_url":       row["qr_url"],
        },
        "line_oa": "@004krtts",
    }
