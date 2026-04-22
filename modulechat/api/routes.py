from fastapi import APIRouter, Depends
from app.auth import require_auth
from app.db import get_db
import datetime

router = APIRouter()

@router.get("/summary")
async def chat_summary(auth=Depends(require_auth), db=Depends(get_db)):
    tenant_id = auth["tenant_id"]
    today = datetime.date.today().isoformat()
    month = today[:7]
    # TODO: query chat tables เมื่อพร้อม
    return {
        "tenant_id": tenant_id,
        "today": 0,
        "month": 0,
        "closed_month": 0,
        "conversion": 0.0,
        "ai_reply_pct": 0.0,
        "live_feed": []
    }

@router.get("/live-feed")
async def chat_live_feed(
    limit: int = 10,
    auth=Depends(require_auth),
    db=Depends(get_db)
):
    # TODO: query chat messages เมื่อพร้อม
    return {
        "feed": [],
        "total": 0
    }

@router.get("/sessions")
async def chat_sessions(
    status: str = "active",
    auth=Depends(require_auth),
    db=Depends(get_db)
):
    # TODO: active chat sessions
    return {"sessions": [], "total": 0}
