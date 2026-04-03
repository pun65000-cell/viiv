from fastapi import APIRouter, Body
from modules.pos import product_service, order_service
from modules.pos.services import shop_service

router = APIRouter(tags=["pos-admin"])


@router.get("/products/list")
def list_products():
    return product_service.list_products()


@router.post("/products/create")
def create_product(payload: dict = Body(...)):
    product_type = payload.get("type") or "normal"
    if product_type == "affiliate":
        return product_service.create_product(
            {
                "type": "affiliate",
                "affiliate_url": payload.get("affiliate_url"),
                "affiliate_title": payload.get("affiliate_title"),
                "affiliate_note": payload.get("affiliate_note"),
                "affiliate_source_title": payload.get("affiliate_source_title"),
                "affiliate_detail_enabled": payload.get("affiliate_detail_enabled"),
                "affiliate_details": payload.get("affiliate_details"),
                "name": payload.get("name"),
                "price": payload.get("price") or 0,
                "image_url": payload.get("image_url"),
            }
        )

    stock = payload.get("stock")
    if stock is None:
        stock = 0
    return product_service.create_product(
        {
            "type": "normal",
            "name": payload.get("name"),
            "price": payload.get("price"),
            "stock": stock,
            "image_url": payload.get("image_url"),
        }
    )


@router.get("/orders/list")
def list_orders():
    return order_service.list_orders()

@router.get("/orders/receipt")
def get_receipt(order_id: str):
    target = None
    for o in getattr(order_service, "orders", []):
        if o.get("order_id") == order_id:
            target = o
            break
    if not target:
        return {"error": "order not found"}
    return order_service.receipt(
        {
            "order_id": target.get("order_id"),
            "items": target.get("items") or [],
            "total": target.get("total") or 0,
        }
    )


@router.get("/staff/list")
def list_staff(shop_id: str | None = None):
    return shop_service.list_staff(shop_id=shop_id)


@router.post("/staff/create")
def create_staff(payload: dict = Body(...)):
    shop_id = payload.get("shop_id") or "default_shop"
    user_id = payload.get("user_id") or payload.get("name") or ""
    role = payload.get("role") or "staff"
    return shop_service.create_staff(shop_id, user_id, role=role)


@router.get("/stock/list")
def list_stock():
    return product_service.list_stock()


@router.post("/stock/adjust")
def adjust_stock(payload: dict = Body(...)):
    product_id = payload.get("product_id")
    delta = payload.get("delta")
    stock = payload.get("stock")
    if stock is not None:
        return product_service.set_stock(product_id, stock)
    return product_service.adjust_stock(product_id, delta)
