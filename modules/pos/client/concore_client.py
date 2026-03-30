from typing import Any, Dict, Optional
import requests

from ..constants import CONCORE_BASE_URL


class ConcoreClient:
  def __init__(self, base_url: str = CONCORE_BASE_URL):
    self.base_url = base_url.rstrip("/")

  def _url(self, path: str) -> str:
    return f"{self.base_url}/{path.lstrip('/')}"

  def post(self, path: str, json_body: Optional[Dict[str, Any]] = None, headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    url = self._url(path)
    h = {"Content-Type": "application/json"}
    if headers:
      h.update(headers)
    r = requests.post(url, json=json_body or {}, headers=h, timeout=30)
    r.raise_for_status()
    return r.json() if r.text else {}
