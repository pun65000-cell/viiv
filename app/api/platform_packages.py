# app/api/platform_packages.py — Platform admin: Credit Packages CRUD
# Endpoints under /api/platform/packages/*

from fastapi import APIRouter, Header, HTTPException
from sqlalchemy import text
from app.core.db import engine
from app.api.platform_connections import _admin_auth

router = APIRouter()

_TYPE_VALUES = {"free", "paid", "custom"}

_EDITABLE_FIELDS = (
    "name", "label", "badge", "type",
    "credit_monthly", "max_members", "max_products",
    "fixed_price", "multiplier", "sort_order",
    "rollover_enabled", "reset_days",
    "ai_model", "unit",
)


def _row_to_dict(r) -> dict:
    return {
        "id":               r["id"],
        "name":             r["name"],
        "label":            r["label"],
        "badge":            r["badge"],
        "type":             r["type"],
        "credit_monthly":   int(r["credit_monthly"]) if r["credit_monthly"] is not None else 0,
        "max_members":      int(r["max_members"]) if r["max_members"] is not None else 0,
        "max_products":     int(r["max_products"]) if r["max_products"] is not None else 0,
        "fixed_price":      float(r["fixed_price"]) if r["fixed_price"] is not None else None,
        "multiplier":       float(r["multiplier"]) if r["multiplier"] is not None else 1.0,
        "sort_order":       int(r["sort_order"]) if r["sort_order"] is not None else 0,
        "rollover_enabled": bool(r["rollover_enabled"]),
        "reset_days":       int(r["reset_days"]) if r["reset_days"] is not None else 30,
        "ai_model":         r["ai_model"],
        "unit":             r["unit"],
        "feature_flags":    r["feature_flags"] if r["feature_flags"] is not None else {},
    }


def _validate(payload: dict, partial: bool = False) -> dict:
    """Validate + coerce. Returns dict of fields-to-write (subset of _EDITABLE_FIELDS)."""
    out = {}
    for k in _EDITABLE_FIELDS:
        if k in payload:
            out[k] = payload[k]

    if not partial:
        # POST: name + label + type required
        if not (out.get("name") or "").strip():
            raise HTTPException(400, "name required")
        if not (out.get("label") or "").strip():
            raise HTTPException(400, "label required")

    if "type" in out:
        t = (out["type"] or "").strip().lower()
        if t not in _TYPE_VALUES:
            raise HTTPException(400, f"type must be one of {sorted(_TYPE_VALUES)}")
        out["type"] = t

    if "credit_monthly" in out:
        try:
            v = int(out["credit_monthly"])
        except (TypeError, ValueError):
            raise HTTPException(400, "credit_monthly must be integer")
        if v < 0:
            raise HTTPException(400, "credit_monthly must be >= 0")
        out["credit_monthly"] = v

    for f in ("max_members", "max_products"):
        if f in out:
            try:
                v = int(out[f])
            except (TypeError, ValueError):
                raise HTTPException(400, f"{f} must be integer")
            if v < -1:
                raise HTTPException(400, f"{f} must be -1 (unlimited) or >= 0")
            out[f] = v

    if "reset_days" in out:
        try:
            v = int(out["reset_days"])
        except (TypeError, ValueError):
            raise HTTPException(400, "reset_days must be integer")
        if v < 1 or v > 365:
            raise HTTPException(400, "reset_days must be in [1, 365]")
        out["reset_days"] = v

    if "rollover_enabled" in out:
        out["rollover_enabled"] = bool(out["rollover_enabled"])

    if "multiplier" in out and out["multiplier"] is not None:
        try:
            v = float(out["multiplier"])
        except (TypeError, ValueError):
            raise HTTPException(400, "multiplier must be number")
        if v < 0:
            raise HTTPException(400, "multiplier must be >= 0")
        out["multiplier"] = v

    if "fixed_price" in out and out["fixed_price"] not in (None, ""):
        try:
            v = float(out["fixed_price"])
        except (TypeError, ValueError):
            raise HTTPException(400, "fixed_price must be number or null")
        if v < 0:
            raise HTTPException(400, "fixed_price must be >= 0")
        out["fixed_price"] = v
    elif "fixed_price" in out:
        out["fixed_price"] = None  # explicit null

    if "sort_order" in out:
        try:
            out["sort_order"] = int(out["sort_order"])
        except (TypeError, ValueError):
            raise HTTPException(400, "sort_order must be integer")

    # name/label/badge: trim or null
    for f in ("name", "label", "badge", "ai_model", "unit"):
        if f in out and out[f] is not None:
            out[f] = str(out[f]).strip() or None

    return out


# ── 1) GET /packages ──────────────────────────────────────────────────────────
@router.get("")
@router.get("/")
def list_packages(authorization: str = Header(None)):
    _admin_auth(authorization)
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT p.id, p.name, p.label, p.badge, p.type,
                   p.credit_monthly, p.max_members, p.max_products,
                   p.fixed_price, p.multiplier, p.sort_order,
                   p.rollover_enabled, p.reset_days,
                   p.ai_model, p.unit, p.feature_flags,
                   COUNT(t.id) AS tenant_count
            FROM packages p
            LEFT JOIN tenants t ON t.package_id = p.id
            GROUP BY p.id
            ORDER BY p.sort_order, p.id
        """)).mappings().all()
    out = []
    for r in rows:
        d = _row_to_dict(r)
        d["tenant_count"] = int(r["tenant_count"] or 0)
        out.append(d)
    return {"packages": out}


# ── 2) PUT /packages/{id} ─────────────────────────────────────────────────────
@router.put("/{pkg_id}")
def update_package(pkg_id: str, payload: dict, authorization: str = Header(None)):
    _admin_auth(authorization)

    fields = _validate(payload or {}, partial=True)
    if not fields:
        raise HTTPException(400, "no editable fields in payload")

    set_clauses = ", ".join(f"{k} = :{k}" for k in fields.keys())
    params = {**fields, "pid": pkg_id}

    with engine.begin() as c:
        if not c.execute(text("SELECT 1 FROM packages WHERE id=:pid"),
                         {"pid": pkg_id}).first():
            raise HTTPException(404, "package not found")
        c.execute(text(f"UPDATE packages SET {set_clauses} WHERE id=:pid"), params)
        row = c.execute(text("""
            SELECT id, name, label, badge, type,
                   credit_monthly, max_members, max_products,
                   fixed_price, multiplier, sort_order,
                   rollover_enabled, reset_days,
                   ai_model, unit, feature_flags
            FROM packages WHERE id=:pid
        """), {"pid": pkg_id}).mappings().first()

    return {"ok": True, "id": pkg_id, "updated": True, "package": _row_to_dict(row)}


# ── 3) POST /packages ─────────────────────────────────────────────────────────
@router.post("")
@router.post("/")
def create_package(payload: dict, authorization: str = Header(None)):
    _admin_auth(authorization)

    fields = _validate(payload or {}, partial=False)

    # Always set defaults if missing (DB defaults exist but be explicit for INSERT)
    fields.setdefault("type", "paid")
    fields.setdefault("credit_monthly", 0)
    fields.setdefault("max_members", 0)
    fields.setdefault("max_products", 0)
    fields.setdefault("multiplier", 1.0)
    fields.setdefault("sort_order", 0)
    fields.setdefault("rollover_enabled", False)
    fields.setdefault("reset_days", 30)

    cols = list(fields.keys())
    cols_sql = ", ".join(cols)
    vals_sql = ", ".join(f":{k}" for k in cols)

    with engine.begin() as c:
        new_id = c.execute(text(f"""
            INSERT INTO packages ({cols_sql})
            VALUES ({vals_sql})
            RETURNING id
        """), fields).scalar()
        row = c.execute(text("""
            SELECT id, name, label, badge, type,
                   credit_monthly, max_members, max_products,
                   fixed_price, multiplier, sort_order,
                   rollover_enabled, reset_days,
                   ai_model, unit, feature_flags
            FROM packages WHERE id=:pid
        """), {"pid": new_id}).mappings().first()

    return {"ok": True, "id": new_id, "package": _row_to_dict(row)}
