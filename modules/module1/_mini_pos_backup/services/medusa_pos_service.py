from modules.module1.mini_pos.adapters import medusa_adapter


def list_products():
    res = medusa_adapter.get_products()
    if isinstance(res, dict) and res.get("error"):
        return res
    if isinstance(res, dict):
        if "products" in res:
            return res["products"]
        if "data" in res:
            return res["data"]
    return res


def create_order(items):
    cart_res = medusa_adapter.create_cart()
    if isinstance(cart_res, dict) and cart_res.get("error"):
        return cart_res

    cart = cart_res.get("cart") if isinstance(cart_res, dict) else None
    cart_id = (cart or cart_res).get("id") if isinstance(cart_res, dict) else None
    if not cart_id:
        return {"error": "invalid_response", "response": cart_res}

    for item in items or []:
        if not isinstance(item, dict):
            continue
        variant_id = item.get("variant_id") or item.get("id") or item.get("product_id")
        quantity = item.get("quantity", 1)
        if not variant_id:
            continue
        add_res = medusa_adapter.add_item(cart_id, str(variant_id), int(quantity))
        if isinstance(add_res, dict) and add_res.get("error"):
            return add_res

    order_res = medusa_adapter.create_order(cart_id)
    return order_res
