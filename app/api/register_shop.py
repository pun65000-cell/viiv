from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, constr
from sqlalchemy.orm import Session
import traceback
from app.core.database import SessionLocal
from app.services import auth as auth_service
from app.repositories import tenants as tenant_repo

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class RegisterShopIn(BaseModel):
    full_name: str
    email: EmailStr
    password: constr(min_length=4, max_length=128)
    store_name: str
    subdomain: constr(strip_whitespace=True, to_lower=True, min_length=3, max_length=100)
    phone: str = None

class RegisterShopOut(BaseModel):
    user_id: str
    tenant_id: int
    subdomain: str
    status: str

@router.post("/register_shop", response_model=RegisterShopOut, status_code=status.HTTP_201_CREATED)
def register_shop(payload: RegisterShopIn, db: Session = Depends(get_db)):
    try:
        print(
            "Attempting to register:",
            {
                "full_name": payload.full_name,
                "email": payload.email,
                "password_len": len(payload.password) if payload.password else 0,
                "store_name": payload.store_name,
                "subdomain": payload.subdomain,
                "phone": payload.phone,
            },
        )
        if tenant_repo.get_tenant_by_subdomain(db, payload.subdomain):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="subdomain taken")
        if tenant_repo.get_tenant_by_email(db, payload.email):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email taken")

        u = auth_service.register(db, payload.email, payload.password)
        if not u:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email taken")

        try:
            t = tenant_repo.create_tenant(
                db,
                full_name=payload.full_name,
                email=payload.email,
                store_name=payload.store_name,
                subdomain=payload.subdomain,
                phone=payload.phone,
                status="pending",
            )
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"SQL Error: {e}")
            raise

        return RegisterShopOut(
            user_id=str(u.id),
            tenant_id=t.id,
            subdomain=t.subdomain,
            status=t.status,
        )
    except HTTPException:
        raise
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "internal server error", "type": type(e).__name__},
        )
