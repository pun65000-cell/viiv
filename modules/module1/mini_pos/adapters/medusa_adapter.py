import os

import requests


def _base_url() -> str:
    return os.environ.get("MEDUSA_URL", "http://localhost:9000").rstrip("/")


def _headers() -> dict:
    key = os.environ.get("MEDUSA_PUBLISHABLE_KEY")
    if key:
        return {"x-publishable-api-key": key}
    return {}


def _request(method: str, path: str, payload: dict | None = None) -> dict:
    url = f"{_base_url()}/store{path}"
    try:
        r = requests.request(
            method=method,
            url=url,
            json=payload,
            headers=_headers(),
            timeout=15,
        )
        r.raise_for_status()
        return r.json()
    except requests.HTTPError as e:
        resp = getattr(e, "response", None)
        body = None
        if resp is not None:
            try:
                body = resp.json()
            except Exception:
                body = {"text": resp.text}
        return {"error": "http_error", "status_code": getattr(resp, "status_code", None), "response": body}
    except requests.RequestException as e:
        return {"error": "request_error", "message": str(e)}


def get_products() -> dict:
    return _request("GET", "/products")


def create_cart() -> dict:
    return _request("POST", "/carts", {})


def add_item(cart_id: str, variant_id: str, quantity: int) -> dict:
    return _request("POST", f"/carts/{cart_id}/line-items", {"variant_id": variant_id, "quantity": int(quantity)})


def create_order(cart_id: str) -> dict:
    return _request("POST", f"/carts/{cart_id}/complete", {})
