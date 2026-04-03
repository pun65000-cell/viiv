from datetime import datetime
from app.core.id import gen_id
from modules.event_bus.event_bus import emit
from modules.pos.product_schema import normalize_product, validate_product


products = {}

def _now():
  return datetime.utcnow().isoformat()

def _get_norm(product_id: str):
  raw = products.get(product_id)
  if not raw:
    return None
  p = normalize_product(raw)
  products[p["product_id"]] = p
  if product_id != p["product_id"]:
    products.pop(product_id, None)
  return p


def _to_thai(product: dict):
  p = normalize_product(product)
  result = {
    "รหัสสินค้า": p["product_id"],
    "ชื่อสินค้า": p["name"],
    "ราคา": p["price"],
    "ประเภท": p["type"],
    "รูปภาพ": p.get("image_url") or "",
    "รายละเอียด": "",
    "ขายแล้ว": 0,
    "มีเดีย": [],
    "created_at": p.get("created_at"),
    "updated_at": p.get("updated_at"),
  }

  if p["type"] == "normal":
    result["สต็อก"] = p.get("stock", 0)
    result["จำนวนคลิก"] = 0
  else:
    result["สต็อก"] = 0
    result["จำนวนคลิก"] = p.get("click_count", 0)
    result["ลิงก์พันธมิตร"] = p.get("affiliate_url") or ""

  return result


def get_raw(product_id: str):
  return products.get(product_id)


def set_raw(product_id: str, product: dict):
  p = normalize_product(product)
  products[p["product_id"]] = p
  if product_id != p["product_id"]:
    products.pop(product_id, None)
  return p


def create_product(payload: dict):
  evt_id = gen_id("evt")
  p = normalize_product(payload)
  if not p.get("product_id"):
    p["product_id"] = gen_id("prd")
  p["created_at"] = p.get("created_at") or _now()
  p["updated_at"] = _now()

  if p.get("type") == "affiliate":
    if not p.get("affiliate_title") and p.get("name"):
      p["affiliate_title"] = p.get("name")
    title = p.get("affiliate_title") or p.get("affiliate_source_title") or p.get("name") or ""
    p["name"] = title
    p["stock"] = 0
    p["price"] = float(p.get("price") or 0)
  else:
    p["price"] = float(p.get("price") or 0)
    p["stock"] = int(p.get("stock") or 0)

  try:
    validate_product(p)
  except Exception as e:
    return {"error": str(e)}

  products[p["product_id"]] = p
  emit("create_product", {"evt": evt_id, "product_id": p.get("product_id")})
  return _to_thai(p)


def list_products():
  return [_to_thai(normalize_product(p)) for p in products.values()]

def list_affiliate_products():
  result = []
  for raw in products.values():
    p = normalize_product(raw)
    if p.get("type") == "affiliate":
      result.append(p)
  return result


def sort_affiliate(products_list, mode):
  if mode == "click":
    return sorted(products_list, key=lambda x: int(x.get("click_count") or 0), reverse=True)
  if mode == "new":
    return sorted(products_list, key=lambda x: str(x.get("created_at") or ""), reverse=True)
  if mode == "old":
    return sorted(products_list, key=lambda x: str(x.get("created_at") or ""))
  return products_list


def get_product(product_id: str):
  p = _get_norm(product_id)
  if p:
    return _to_thai(p)
  return {"error": "product not found"}


def update_stock(product_id: str, stock):
  p = _get_norm(product_id)
  if not p:
    return {"error": "product not found"}
  if p.get("type") != "normal":
    raise Exception("affiliate product has no stock")
  p["stock"] = int(stock or 0)
  p["updated_at"] = _now()
  products[p["product_id"]] = p
  return _to_thai(p)


def add_media(product_id: str, media_type, url):
  p = _get_norm(product_id)
  if not p:
    return {"error": "product not found"}
  return _to_thai(p)


def click(product_id: str):
  return track_click(product_id)


def track_click(product_id: str):
  p = _get_norm(product_id)
  if not p:
    return {"error": "product not found"}
  if p.get("type") != "affiliate":
    return {"error": "not affiliate product"}
  evt_id = gen_id("evt")
  p["click_count"] = int(p.get("click_count") or 0) + 1
  p["updated_at"] = _now()
  products[p["product_id"]] = p
  emit("product_click", {"evt": evt_id, "product_id": p["product_id"], "click_count": p["click_count"]})
  return _to_thai(p)


def adjust_stock(product_id: str, delta):
  if not product_id:
    return {"error": "product_id required"}
  p = _get_norm(product_id)
  if not p:
    return {"error": "product not found"}
  evt_id = gen_id("evt")
  try:
    d = int(delta)
  except Exception:
    return {"error": "delta must be int"}
  if p.get("type") != "normal":
    raise Exception("affiliate product has no stock")
  current = int(p.get("stock") or 0)
  p["stock"] = max(0, current + d)
  p["updated_at"] = _now()
  products[p["product_id"]] = p
  emit("adjust_stock", {"evt": evt_id, "product_id": p["product_id"], "delta": d, "stock": p["stock"]})
  return {"product_id": p["product_id"], "stock": p["stock"], "updated_at": p["updated_at"]}


def set_stock(product_id: str, stock):
  if not product_id:
    return {"error": "product_id required"}
  p = _get_norm(product_id)
  if not p:
    return {"error": "product not found"}
  evt_id = gen_id("evt")
  try:
    s = int(stock)
  except Exception:
    return {"error": "stock must be int"}
  if p.get("type") != "normal":
    raise Exception("affiliate product has no stock")
  p["stock"] = max(0, s)
  p["updated_at"] = _now()
  products[p["product_id"]] = p
  emit("adjust_stock", {"evt": evt_id, "product_id": p["product_id"], "delta": None, "stock": p["stock"]})
  return {"product_id": p["product_id"], "stock": p["stock"], "updated_at": p["updated_at"]}


def list_stock():
  items = []
  for raw in products.values():
    p = normalize_product(raw)
    if p.get("type") != "normal":
      continue
    items.append(
      {
        "product_id": p.get("product_id"),
        "product_name": p.get("name"),
        "current_stock": int(p.get("stock") or 0),
        "last_update": p.get("updated_at") or None,
      }
    )
  return items
