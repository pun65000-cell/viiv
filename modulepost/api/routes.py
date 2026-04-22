from fastapi import APIRouter, Depends
from app.auth import require_auth
from app.db import get_db
import datetime

router = APIRouter()

@router.get("/summary")
async def post_summary(auth=Depends(require_auth), db=Depends(get_db)):
    tenant_id = auth["tenant_id"]
    return {
        "tenant_id": tenant_id,
        "posts_today": 0,
        "posts_month": 0,
        "views_month": 0,
        "queue": 0,
        "building": 0,
        "hook_latest": "",
        "platforms": {
            "tiktok": 0,
            "instagram": 0,
            "facebook": 0,
            "line": 0
        }
    }

@router.get("/posts")
async def post_list(
    limit: int = 20,
    offset: int = 0,
    auth=Depends(require_auth),
    db=Depends(get_db)
):
    return {"posts": [], "total": 0}

@router.get("/queue")
async def post_queue(auth=Depends(require_auth), db=Depends(get_db)):
    return {"queue": [], "total": 0}
