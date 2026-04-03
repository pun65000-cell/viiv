from typing import Dict, Any

from .client.concore_client import ConcoreClient
from datetime import datetime

from . import cart_service, product_service
from app.core.id import gen_id
from modules.event_bus.event_bus import emit


class OrderService:
  def __init__(self, client: ConcoreClient):
    self.client = client

  def checkout(self, payload: Dict[str, Any]) -> Dict[str, Any]:
    return self.client.post("/order/checkout", json_body=payload)


orders = []


def checkout(payload: dict):
  evt_id = gen_id("evt")
  cart_id = payload["cart_id"]

  if cart_id not in cart_service.carts:
    return {"error": "cart not found"}

  cart = cart_service.carts[cart_id]

  for item in cart.get("items", []):
    product_id = item.get("product_id")
    quantity = item.get("quantity") or 0

    product = product_service.get_raw(product_id)
    if not product:
      return {"error": "product not found"}

    if product.get("type") != "normal":
      return {"error": "affiliate product cannot checkout"}

    stock = product.get("stock")
    if stock is None:
      return {"error": "stock required"}

    if stock < quantity:
      return {"error": "out of stock"}

    product_service.adjust_stock(product_id, -int(quantity))
    product = product_service.get_raw(product_id) or product
    product["sold"] = (product.get("sold") or 0) + quantity
    product_service.set_raw(product_id, product)

  order = {
    "order_id": payload.get("order_id") or gen_id("ord"),
    "items": cart.get("items") or [],
    "total": cart.get("total") or 0,
    "status": "waiting_payment",
  }
  orders.append(order)
  emit("create_order", {"evt": evt_id, "order_id": order.get("order_id")})
  return order


def confirm_payment(payload: dict):
  order_id = payload["order_id"]
  for order in orders:
    if order.get("order_id") == order_id:
      order["status"] = "paid"
      return order
  return {"error": "order not found"}


def list_orders():
  return [
    {"order_id": o.get("order_id"), "total": o.get("total"), "status": o.get("status")}
    for o in orders
  ]


def receipt(payload: dict):
  return {
    "receipt_id": payload.get("receipt_id") or gen_id("evt"),
    "order_id": payload["order_id"],
    "items": payload["items"],
    "total": payload["total"],
    "issued_at": datetime.utcnow().isoformat(),
    "status": "issued",
  }
