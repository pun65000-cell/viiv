from sqlalchemy import text
from app.core.database import SessionLocal
from app.core.id import gen_id
from modules.event_bus.event_bus import emit

_shops_mem = {}
_staff_mem = []


def create_shop(owner_user_id, name):
    evt_id = gen_id("evt")
    shop_id = gen_id("shp")
    try:
        db = SessionLocal()
        try:
            db.execute(
                text("INSERT INTO shops (id, owner_user_id, name) VALUES (:id, :owner_user_id, :name)"),
                {"id": shop_id, "owner_user_id": str(owner_user_id) if owner_user_id is not None else None, "name": name},
            )
            db.commit()
        finally:
            db.close()
        print("POS SHOP CREATED:", shop_id)
        shop = {"id": shop_id, "owner_user_id": str(owner_user_id) if owner_user_id is not None else None, "name": name}
        _shops_mem[shop_id] = shop
        emit("create_shop", {"evt": evt_id, "shop_id": shop_id})
        return shop
    except Exception as e:
        print("POS SHOP CREATE FAILED:", e)
        shop = {"id": shop_id, "owner_user_id": str(owner_user_id) if owner_user_id is not None else None, "name": name}
        _shops_mem[shop_id] = shop
        emit("create_shop", {"evt": evt_id, "shop_id": shop_id})
        return shop


def create_staff(shop_id, user_id, role="admin"):
    evt_id = gen_id("evt")
    staff_id = gen_id("stf")
    try:
        db = SessionLocal()
        try:
            db.execute(
                text("INSERT INTO staff (id, shop_id, user_id, role) VALUES (:id, :shop_id, :user_id, :role)"),
                {
                    "id": staff_id,
                    "shop_id": str(shop_id) if shop_id is not None else None,
                    "user_id": str(user_id) if user_id is not None else None,
                    "role": role,
                },
            )
            db.commit()
        finally:
            db.close()
        print("POS STAFF CREATED:", staff_id)
        staff = {
            "id": staff_id,
            "shop_id": str(shop_id) if shop_id is not None else None,
            "user_id": str(user_id) if user_id is not None else None,
            "role": role,
        }
        _staff_mem.append(staff)
        emit("create_staff", {"evt": evt_id, "staff_id": staff_id, "shop_id": str(shop_id) if shop_id is not None else None})
        return staff
    except Exception as e:
        print("POS STAFF CREATE FAILED:", e)
        staff = {
            "id": staff_id,
            "shop_id": str(shop_id) if shop_id is not None else None,
            "user_id": str(user_id) if user_id is not None else None,
            "role": role,
        }
        _staff_mem.append(staff)
        emit("create_staff", {"evt": evt_id, "staff_id": staff_id, "shop_id": str(shop_id) if shop_id is not None else None})
        return staff


def list_staff(shop_id: str | None = None):
    if shop_id:
        return [s for s in _staff_mem if s.get("shop_id") == shop_id]
    return list(_staff_mem)
