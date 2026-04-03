from fastapi import APIRouter, Body, Request
from modules.pos import product_service
from modules.pos.product_schema import build_affiliate_context, normalize_product


router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/start")
def start_chat(request: Request, product_id: str | None = None):
    if product_id:
        request.session["product_id"] = product_id
    pid = request.session.get("product_id")
    raw = product_service.get_raw(pid) if pid else None
    product = normalize_product(raw) if raw else None
    return {"ok": True, "product_id": pid, "product": product}


@router.post("/message")
def chat_message(request: Request, payload: dict = Body(...)):
    msg = (payload.get("message") or "").strip()
    pid = request.session.get("product_id")
    if not pid:
        return {"error": "product_id not set"}

    raw = product_service.get_raw(pid)
    if not raw:
        return {"error": "product not found"}

    p = normalize_product(raw)
    affiliate_url = p.get("affiliate_url") or ""
    track_url = f"/api/track/click?product_id={pid}&source=chat"
    context = build_affiliate_context(p)

    reply = {
        "text": (
            f"{context}\n"
            f"product_id: {p.get('product_id')}\n"
            f"affiliate_url: {affiliate_url or '-'}\n"
            f"คำถาม: {msg or '-'}\n"
            f"ลิงก์แนะนำ: {track_url}"
        )
    }

    return {
        "reply": reply,
        "product": p,
        "affiliate_url": affiliate_url,
        "track_url": track_url,
    }
