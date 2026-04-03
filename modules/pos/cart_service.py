from typing import Dict, Any

from .client.concore_client import ConcoreClient
from app.core.id import gen_id

from . import product_service

class CartService:
  def __init__(self, client: ConcoreClient):
    self.client = client

  def create(self, payload: Dict[str, Any]) -> Dict[str, Any]:
    return self.client.post("/cart/create", json_body=payload)

  def add_item(self, payload: Dict[str, Any]) -> Dict[str, Any]:
    return self.client.post("/cart/add-item", json_body=payload)

  def get(self, payload: Dict[str, Any]) -> Dict[str, Any]:
    return self.client.post("/cart/get", json_body=payload)


carts = {}


def create_cart():
  cart_id = gen_id("crt")
  carts[cart_id] = {"items": [], "total": 0}
  return {"cart_id": cart_id, "items": [], "total": 0}


def add_item(payload: dict):
  cart_id = payload["cart_id"]
  product_id = payload["product_id"]
  quantity = payload["quantity"]

  if cart_id not in carts:
    return {"error": "cart not found"}

  product = product_service.get_raw(product_id)
  if not product:
    return {"error": "product not found"}

  if product.get("type") == "affiliate":
    return {
      "type": "affiliate",
      "redirect_url": product.get("affiliate_url"),
    }

  price = product.get("price")
  item = {
    "product_id": product_id,
    "quantity": quantity,
    "price": price,
  }

  carts[cart_id]["items"].append(item)
  carts[cart_id]["total"] += (price or 0) * quantity
  return carts[cart_id]


def get_cart(payload: dict):
  cart_id = payload["cart_id"]
  if cart_id in carts:
    return carts[cart_id]
  return {
    "items": [],
    "total": 0,
  }
