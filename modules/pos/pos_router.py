from typing import Dict, Any
from fastapi import APIRouter, Body, HTTPException

from .client.concore_client import ConcoreClient
from .cart_service import CartService
from .order_service import OrderService


router = APIRouter(prefix="/pos", tags=["pos"])

_client = ConcoreClient()
_cart = CartService(_client)
_orders = OrderService(_client)


@router.post("/cart/create")
def create_cart(payload: Dict[str, Any] = Body(...)):
  try:
    return _cart.create(payload)
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))


@router.post("/cart/add-item")
def add_item(payload: Dict[str, Any] = Body(...)):
  try:
    return _cart.add_item(payload)
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))


@router.post("/cart/get")
def get_cart(payload: Dict[str, Any] = Body(...)):
  try:
    return _cart.get(payload)
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))


@router.post("/checkout")
def checkout(payload: Dict[str, Any] = Body(...)):
  try:
    return _orders.checkout(payload)
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))
