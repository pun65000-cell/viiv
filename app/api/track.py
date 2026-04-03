from fastapi import APIRouter
from fastapi.responses import RedirectResponse
from modules.pos import product_service
from app.core.id import gen_id
from modules.event_bus.event_bus import emit


router = APIRouter(prefix="/track", tags=["track"])


@router.get("/click")
def track_click(product_id: str, source: str | None = None):
    result = product_service.track_click(product_id)
    if not result or result.get("error"):
        return {"error": "product not found"}

    raw = product_service.get_raw(product_id)
    if not raw:
        return {"error": "product not found"}

    url = raw.get("affiliate_url")
    if not url:
        return {"error": "affiliate_url not found"}

    if source == "chat":
        emit("affiliate_conversion", {"evt": gen_id("evt"), "product_id": product_id, "source": "chat"})

    return RedirectResponse(url=url, status_code=302)
