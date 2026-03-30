from typing import TypedDict, List, Optional, Any


class CartCreatePayload(TypedDict, total=False):
  user_id: str


class CartAddItemPayload(TypedDict, total=False):
  cart_id: str
  product_id: str
  quantity: int


class CartGetPayload(TypedDict, total=False):
  cart_id: str


class CheckoutPayload(TypedDict, total=False):
  order_id: Optional[str]
  cart_id: Optional[str]
  items: Optional[List[dict]]


class APIResponse(TypedDict, total=False):
  success: Optional[bool]
  data: Optional[Any]
  message: Optional[str]
  error: Optional[Any]
