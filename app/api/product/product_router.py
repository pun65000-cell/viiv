from fastapi import APIRouter
import uuid

router = APIRouter(prefix="/product", tags=["product"])

products = {}


def _to_thai(product: dict):
    result = {
        "รหัสสินค้า": product["id"],
        "ชื่อสินค้า": product["name"],
        "ราคา": product["price"],
        "ประเภท": product["type"],
        "รูปภาพ": product.get("image_url") or "",
        "รายละเอียด": product.get("description") or "",
        "ขายแล้ว": product.get("sold", 0),
        "มีเดีย": product.get("media", []),
    }

    if product["type"] == "normal":
        result["สต็อก"] = product.get("stock", 0)
        result["จำนวนคลิก"] = 0
    else:
        result["สต็อก"] = 0
        result["จำนวนคลิก"] = product.get("click_count", 0)
        result["ลิงก์พันธมิตร"] = product.get("affiliate_url") or ""

    return result


@router.post("/create")
def create_product(payload: dict):
    product_type = payload.get("type")

    if product_type == "affiliate":
        affiliate_url = payload.get("affiliate_url")
        if not affiliate_url:
            return {"error": "affiliate_url required"}
        product = {
            "id": f"prod_{uuid.uuid4().hex[:8]}",
            "name": payload.get("name"),
            "type": "affiliate",
            "price": payload.get("price"),
            "image_url": payload.get("image_url"),
            "description": payload.get("description"),
            "stock": 0,
            "sold": 0,
            "click_count": 0,
            "media": payload.get("media") or [],
            "affiliate_url": affiliate_url,
        }
    else:
        stock = payload.get("stock")
        if stock is None:
            return {"error": "stock required"}
        product = {
            "id": f"prod_{uuid.uuid4().hex[:8]}",
            "name": payload.get("name"),
            "type": "normal",
            "price": payload.get("price"),
            "image_url": payload.get("image_url"),
            "description": payload.get("description"),
            "stock": stock,
            "sold": 0,
            "click_count": 0,
            "media": payload.get("media") or [],
            "affiliate_url": "",
        }

    products[product["id"]] = product
    return _to_thai(product)


@router.get("/list")
def list_products():
    return [_to_thai(p) for p in products.values()]


@router.post("/get")
def get_product(payload: dict):
    product_id = payload.get("id")
    if product_id in products:
        return _to_thai(products[product_id])
    return {"error": "product not found"}


@router.post("/update-stock")
def update_stock(payload: dict):
    product_id = payload.get("id")
    stock = payload.get("stock")

    if product_id not in products:
        return {"error": "product not found"}

    product = products[product_id]
    if product.get("type") != "normal":
        return {"error": "cannot update stock for affiliate product"}

    product["stock"] = stock
    products[product_id] = product
    return _to_thai(product)


@router.post("/add-media")
def add_media(payload: dict):
    product_id = payload.get("product_id")
    media_type = payload.get("type")
    url = payload.get("url")

    if product_id not in products:
        return {"error": "product not found"}

    product = products[product_id]
    media = product.get("media") or []
    media.append({"type": media_type, "url": url})
    product["media"] = media
    products[product_id] = product
    return _to_thai(product)


@router.post("/click")
def click(payload: dict):
    product_id = payload.get("product_id")

    if product_id not in products:
        return {"error": "product not found"}

    product = products[product_id]
    if product.get("type") != "affiliate":
        return {"error": "not affiliate product"}

    product["click_count"] = (product.get("click_count") or 0) + 1
    products[product_id] = product
    return _to_thai(product)
