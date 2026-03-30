from typing import Dict, Any

from .client.concore_client import ConcoreClient

class CartService:
  def __init__(self, client: ConcoreClient):
    self.client = client

  def create(self, payload: Dict[str, Any]) -> Dict[str, Any]:
    return self.client.post("/cart/create", json_body=payload)

  def add_item(self, payload: Dict[str, Any]) -> Dict[str, Any]:
    return self.client.post("/cart/add-item", json_body=payload)

  def get(self, payload: Dict[str, Any]) -> Dict[str, Any]:
    return self.client.post("/cart/get", json_body=payload)
