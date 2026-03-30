from fastapi import APIRouter
import uuid
from datetime import datetime
from app.api.product.product_router import products

router = APIRouter(prefix="/cart", tags=["cart"])
order_router = APIRouter(prefix="/order", tags=["order"])

carts = {}
orders = []


@router.post("/create")
def create_cart():
    cart_id = f"cart_{uuid.uuid4().hex[:8]}"
    carts[cart_id] = {"items": [], "total": 0}
    return {"cart_id": cart_id, "items": [], "total": 0}


@router.post("/add-item")
def add_item(payload: dict):
    cart_id = payload["cart_id"]
    product_id = payload["product_id"]
    quantity = payload["quantity"]

    if cart_id not in carts:
        return {"error": "cart not found"}

    if product_id not in products:
        return {"error": "product not found"}

    product = products[product_id]

    if product["type"] == "affiliate":
        return {
            "type": "affiliate",
            "redirect_url": product["affiliate_url"],
        }

    price = product["price"]

    item = {
        "product_id": product_id,
        "quantity": quantity,
        "price": price,
    }

    carts[cart_id]["items"].append(item)

    carts[cart_id]["total"] += price * quantity

    return carts[cart_id]


@router.post("/get")
def get_cart(payload: dict):
    cart_id = payload["cart_id"]

    if cart_id in carts:
        return carts[cart_id]

    return {
        "items": [],
        "total": 0,
    }


@order_router.post("/checkout")
def checkout(payload: dict):
    cart_id = payload["cart_id"]

    if cart_id not in carts:
        return {"error": "cart not found"}

    cart = carts[cart_id]

    for item in cart.get("items", []):
        product_id = item.get("product_id")
        quantity = item.get("quantity") or 0

        if product_id not in products:
            return {"error": "product not found"}

        product = products[product_id]
        if product.get("type") != "normal":
            return {"error": "affiliate product cannot checkout"}

        stock = product.get("stock")
        if stock is None:
            return {"error": "stock required"}

        if stock < quantity:
            return {"error": "out of stock"}

        product["stock"] = stock - quantity
        product["sold"] = (product.get("sold") or 0) + quantity
        products[product_id] = product

    order = {
        "order_id": f"order_{uuid.uuid4().hex[:8]}",
        "items": cart["items"],
        "total": cart["total"],
        "status": "waiting_payment",
    }
    orders.append(order)
    return order


@order_router.post("/confirm-payment")
def confirm_payment(payload: dict):
    order_id = payload["order_id"]
    for order in orders:
        if order.get("order_id") == order_id:
            order["status"] = "paid"
            return order
    return {"error": "order not found"}


@order_router.get("/list")
def list_orders():
    return [
        {"order_id": o.get("order_id"), "total": o.get("total"), "status": o.get("status")}
        for o in orders
    ]


@order_router.post("/receipt")
def generate_receipt(payload: dict):
    return {
        "receipt_id": f"receipt_{uuid.uuid4().hex[:8]}",
        "order_id": payload["order_id"],
        "items": payload["items"],
        "total": payload["total"],
        "issued_at": datetime.utcnow().isoformat(),
        "status": "issued",
    }
