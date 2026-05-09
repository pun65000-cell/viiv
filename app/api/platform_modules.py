# app/api/platform_modules.py — Platform admin: Module Prices (read+update only)
# Endpoints under /api/platform/module-prices/*
# Module list is fixed at 4 (pos/affiliate/chat/autopost) — no POST/DELETE.

from fastapi import APIRouter, Header, HTTPException
from sqlalchemy import text
from app.core.db import engine
from app.api.platform_connections import _admin_auth

router = APIRouter()

_EDITABLE = ("label", "price", "is_required", "sort_order")


def _row_to_dict(r) -> dict:
    return {
        "module":      r["module"],
        "label":       r["label"],
        "price":       float(r["price"]) if r["price"] is not None else 0.0,
        "is_required": bool(r["is_required"]),
        "sort_order":  int(r["sort_order"]) if r["sort_order"] is not None else 0,
    }


def _validate(payload: dict) -> dict:
    out = {}
    for k in _EDITABLE:
        if k in payload:
            out[k] = payload[k]

    if "price" in out:
        try:
            v = float(out["price"])
        except (TypeError, ValueError):
            raise HTTPException(400, "price must be number")
        if v < 0:
            raise HTTPException(400, "price must be >= 0")
        out["price"] = v

    if "is_required" in out:
        out["is_required"] = bool(out["is_required"])

    if "sort_order" in out:
        try:
            out["sort_order"] = int(out["sort_order"])
        except (TypeError, ValueError):
            raise HTTPException(400, "sort_order must be integer")

    if "label" in out and out["label"] is not None:
        out["label"] = str(out["label"]).strip() or None

    return out


@router.get("/module-prices")
@router.get("/module-prices/")
def list_module_prices(
    is_required: bool | None = None,
    authorization: str = Header(None),
):
    _admin_auth(authorization)
    where = "WHERE is_required = :is_required" if is_required is not None else ""
    sql = f"""
        SELECT module, label, price, is_required, sort_order
        FROM module_prices
        {where}
        ORDER BY sort_order, module
    """
    params = {"is_required": is_required} if is_required is not None else {}
    with engine.connect() as c:
        rows = c.execute(text(sql), params).mappings().all()
    return {"modules": [_row_to_dict(r) for r in rows]}


@router.put("/module-prices/{module}")
def update_module_price(module: str, payload: dict, authorization: str = Header(None)):
    _admin_auth(authorization)

    fields = _validate(payload or {})
    if not fields:
        raise HTTPException(400, "no editable fields in payload")

    set_clauses = ", ".join(f"{k} = :{k}" for k in fields.keys())
    params = {**fields, "module": module}

    with engine.begin() as c:
        if not c.execute(text("SELECT 1 FROM module_prices WHERE module=:module"),
                         {"module": module}).first():
            raise HTTPException(404, "module not found")
        c.execute(text(f"UPDATE module_prices SET {set_clauses} WHERE module=:module"), params)
        row = c.execute(text("""
            SELECT module, label, price, is_required, sort_order
            FROM module_prices WHERE module=:module
        """), {"module": module}).mappings().first()

    return {"ok": True, "module": module, "updated": True, "data": _row_to_dict(row)}
