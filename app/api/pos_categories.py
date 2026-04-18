from fastapi import APIRouter, Header
from sqlalchemy import text
from app.core.db import engine
from app.api.pos_bills import get_tenant_user
from app.core.id import gen_id
import json

router = APIRouter(prefix="/api/pos/categories")

@router.get("/list")
def list_categories(authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.connect() as c:
        rows = c.execute(text("SELECT * FROM categories WHERE tenant_id=:tid ORDER BY sort_order,name"),{"tid":tid}).fetchall()
    return [dict(r._mapping) for r in rows]

@router.post("/create")
def create_category(payload: dict, authorization: str = Header("")):
    tid, uid = get_tenant_user(authorization)
    cid = gen_id("cat")
    with engine.begin() as c:
        c.execute(text("""INSERT INTO categories(id,tenant_id,name,description,color,icon,sort_order,is_visible)
            VALUES(:id,:tid,:name,:desc,:color,:icon,:sort,:vis)"""),
            {"id":cid,"tid":tid,"name":payload.get("name",""),"desc":payload.get("description",""),
             "color":payload.get("color","#e8b93e"),"icon":payload.get("icon",""),
             "sort":payload.get("sort_order",0),"vis":payload.get("is_visible",True)})
    return {"id":cid,"ok":True}

@router.put("/update/{cid}")
def update_category(cid: str, payload: dict, authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    sets,params = [],{"id":cid,"tid":tid}
    for f in ["name","description","color","icon","sort_order","is_visible"]:
        if f in payload:
            sets.append(f+"=:"+f); params[f]=payload[f]
    if not sets: return {"ok":True}
    sets.append("updated_at=NOW()")
    with engine.begin() as c:
        c.execute(text('UPDATE categories SET '+','.join(sets)+' WHERE id=:id AND tenant_id=:tid'),params)
    return {"ok":True}

@router.delete("/delete/{cid}")
def delete_category(cid: str, authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    with engine.begin() as c:
        c.execute(text("DELETE FROM categories WHERE id=:id AND tenant_id=:tid"),{"id":cid,"tid":tid})
    return {"ok":True}

@router.post("/reorder")
def reorder_categories(payload: dict, authorization: str = Header("")):
    tid, _ = get_tenant_user(authorization)
    ids = payload.get("ids",[])
    with engine.begin() as c:
        for i,cid in enumerate(ids):
            c.execute(text("UPDATE categories SET sort_order=:o WHERE id=:id AND tenant_id=:tid"),{"o":i,"id":cid,"tid":tid})
    return {"ok":True}
