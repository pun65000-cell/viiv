from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from uuid import UUID
from app.core.db import SessionLocal
from modules.module1.models import Product, Order
from concore.permissions.permission_model import Role
from concore.permissions.permission_service import check_permission
from pydantic import BaseModel, constr

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def require_owner(x_role: str | None = Header(None)):
    if x_role != Role.OWNER.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    if not check_permission(Role.OWNER, "products.manage"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    return Role.OWNER

class ProductIn(BaseModel):
    name: constr(min_length=1, max_length=255)
    description: str | None = None
    price: float

@router.get("/api/dashboard")
def dashboard(request: Request, role: Role = Depends(require_owner), db: Session = Depends(get_db)):
    tenant_id = getattr(request.state, "tenant_id", None)
    if not tenant_id:
        return {"orders": 0, "revenue": 0}
    orders_count = db.execute(select(func.count()).select_from(Order).where(Order.tenant_id == tenant_id)).scalar_one()
    revenue = db.execute(select(func.coalesce(func.sum(Order.total), 0)).where(Order.tenant_id == tenant_id)).scalar_one()
    return {"orders": int(orders_count), "revenue": float(revenue)}

@router.get("/api/products")
def list_products(request: Request, role: Role = Depends(require_owner), db: Session = Depends(get_db)):
    tenant_id = getattr(request.state, "tenant_id", None)
    if not tenant_id:
        return []
    items = db.execute(select(Product).where(Product.tenant_id == tenant_id)).scalars().all()
    return [{"id": str(i.id), "name": i.name, "price": float(i.price)} for i in items]

@router.post("/api/products", status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductIn, request: Request, role: Role = Depends(require_owner), db: Session = Depends(get_db)):
    tenant_id = getattr(request.state, "tenant_id", None)
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY)
    p = Product(name=payload.name, description=payload.description, price=payload.price, tenant_id=tenant_id)
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"id": str(p.id), "name": p.name, "price": float(p.price)}

@router.delete("/api/products/{pid}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(pid: UUID, request: Request, role: Role = Depends(require_owner), db: Session = Depends(get_db)):
    tenant_id = getattr(request.state, "tenant_id", None)
    p = db.get(Product, pid)
    if not p or (tenant_id and p.tenant_id != tenant_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    db.delete(p)
    db.commit()
    return None
