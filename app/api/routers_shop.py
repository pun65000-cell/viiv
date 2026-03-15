from fastapi import APIRouter, Request, HTTPException

router = APIRouter()

@router.get("/{shop}/dashboard")
def dashboard(shop: str, request: Request):
    if not getattr(request.state, "tenant_id", None):
        raise HTTPException(status_code=404)
    return {"shop": shop, "tenant_id": str(request.state.tenant_id), "section": "dashboard"}

@router.get("/{shop}/pos")
def pos(shop: str, request: Request):
    if not getattr(request.state, "tenant_id", None):
        raise HTTPException(status_code=404)
    return {"shop": shop, "tenant_id": str(request.state.tenant_id), "section": "pos"}

@router.get("/{shop}/customers")
def customers(shop: str, request: Request):
    if not getattr(request.state, "tenant_id", None):
        raise HTTPException(status_code=404)
    return {"shop": shop, "tenant_id": str(request.state.tenant_id), "section": "customers"}
