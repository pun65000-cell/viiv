from fastapi import APIRouter, Body, Request

from modules.pos.product_service import create_product, list_products

router = APIRouter(prefix="/api/merchant", tags=["merchant"])


@router.get("/products")
def get_products(request: Request):
    tenant_id = getattr(request.state, "tenant_id", None)
    try:
        return list_products(tenant_id)
    except TypeError:
        return list_products()


@router.post("/products")
def create_new_product(request: Request, body: dict = Body(...)):
    print("CREATE PRODUCT HIT", body)
    tenant_id = getattr(request.state, "tenant_id", None)
    user_id = getattr(request.state, "user_id", None)
    try:
        return create_product(tenant_id=tenant_id, user_id=user_id, data=body)
    except TypeError:
        payload = dict(body or {})
        payload.setdefault("tenant_id", tenant_id)
        payload.setdefault("user_id", user_id)
        return create_product(payload)
