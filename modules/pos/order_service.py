from typing import Dict, Any

from .client.concore_client import ConcoreClient


class OrderService:
  def __init__(self, client: ConcoreClient):
    self.client = client

  def checkout(self, payload: Dict[str, Any]) -> Dict[str, Any]:
    return self.client.post("/order/checkout", json_body=payload)
