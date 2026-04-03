from datetime import datetime


REQUIRED_FIELDS = ["product_id", "type"]


def _now():
    return datetime.utcnow().isoformat()


def normalize_product(p: dict):
    src = p or {}
    product_id = src.get("product_id") or src.get("id")
    product_type = src.get("type") or "normal"

    name = src.get("name")
    image_url = src.get("image_url")

    price = src.get("price", 0)
    stock = src.get("stock", 0)

    affiliate_url = src.get("affiliate_url")
    affiliate_title = src.get("affiliate_title")
    affiliate_note = src.get("affiliate_note")
    affiliate_source_title = src.get("affiliate_source_title")
    affiliate_detail_enabled = bool(src.get("affiliate_detail_enabled") or False)
    affiliate_details = src.get("affiliate_details")
    if not isinstance(affiliate_details, dict):
        affiliate_details = {}

    click_count = src.get("click_count", 0)
    order_count = src.get("order_count", 0)

    created_at = src.get("created_at")
    updated_at = src.get("updated_at")

    try:
        price = 0 if price is None else float(price)
    except Exception:
        price = 0

    try:
        stock = 0 if stock is None else int(stock)
    except Exception:
        stock = 0

    try:
        click_count = 0 if click_count is None else int(click_count)
    except Exception:
        click_count = 0

    try:
        order_count = 0 if order_count is None else int(order_count)
    except Exception:
        order_count = 0

    if not created_at:
        created_at = _now()
    if not updated_at:
        updated_at = created_at

    return {
        "product_id": product_id,
        "type": product_type,
        "name": name,
        "image_url": image_url,
        "price": price,
        "stock": stock,
        "affiliate_url": affiliate_url,
        "affiliate_title": affiliate_title,
        "affiliate_note": affiliate_note,
        "affiliate_source_title": affiliate_source_title,
        "affiliate_detail_enabled": affiliate_detail_enabled,
        "affiliate_details": affiliate_details,
        "click_count": click_count,
        "order_count": order_count,
        "created_at": created_at,
        "updated_at": updated_at,
    }


def validate_product(p: dict):
    if not p.get("product_id"):
        raise Exception("product_id required")

    if p.get("type") not in ["normal", "affiliate"]:
        raise Exception("invalid product type")

    if p["type"] == "normal":
        if p.get("price") is None:
            raise Exception("price required for normal product")

    if p["type"] == "affiliate":
        if not p.get("affiliate_url"):
            raise Exception("affiliate_url required")


def build_affiliate_context(product):
    p = normalize_product(product or {})
    title = p.get("affiliate_title") or p.get("affiliate_source_title") or p.get("name") or "-"
    note = p.get("affiliate_note") or ""
    details = p.get("affiliate_details") or {}
    parts = [f"\nสินค้า: {title}", f"รายละเอียด: {note}"]
    if details:
        parts.append("รายละเอียดสินค้า:")
        for k, v in details.items():
            if v is None or v == "":
                continue
            if isinstance(v, list):
                parts.append(f"- {k}: {', '.join([str(x) for x in v if str(x)])}")
            else:
                parts.append(f"- {k}: {v}")
    return "\n".join(parts) + "\n"
