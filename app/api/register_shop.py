from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, constr
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.services import auth as auth_service
from app.repositories import tenants as tenant_repo
from app.core.id_generator import generate_id
from modules.pos.services import shop_service

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class RegisterShopIn(BaseModel):
    email: EmailStr
    password: constr(min_length=8, max_length=128)
    shop_slug: constr(strip_whitespace=True, to_lower=True, min_length=3, max_length=100)

class RegisterShopOut(BaseModel):
    user_id: str
    user_code: str
    tenant_id: str
    slug: str
    package: str

@router.post("/register_shop", response_model=RegisterShopOut, status_code=status.HTTP_201_CREATED)
def register_shop(payload: RegisterShopIn, db: Session = Depends(get_db)):
    if tenant_repo.get_tenant_by_slug(db, payload.shop_slug):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="shop slug taken")
    u = auth_service.register(db, payload.email, payload.password)
    if not u:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email taken")
    code = generate_id("usr")
    t = tenant_repo.create_tenant(db, slug=payload.shop_slug, name=payload.shop_slug, owner_user_id=u.id, package="BASIC")
    db.commit()
    try:
        shop = shop_service.create_shop(str(u.id), payload.shop_slug)
        if shop and shop.get("id"):
            shop_service.create_staff(shop.get("id"), str(u.id), role="admin")
    except Exception as e:
        print("POS AUTO CREATE FAILED:", e)
    return RegisterShopOut(user_id=str(u.id), user_code=code, tenant_id=str(t.id), slug=t.slug, package=t.package)
