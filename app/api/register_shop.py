from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, constr, field_validator
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import traceback, uuid
from app.core.database import SessionLocal
from app.services import auth as auth_service
from app.repositories import tenants as tenant_repo

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

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
    subdomain: constr(strip_whitespace=True, to_lower=True, min_length=4, max_length=40)
    phone: str = None
    tier: str | None = None

    @field_validator('tier')
    @classmethod
    def _validate_tier(cls, v):
        if v is None or v == '':
            return None
        if not v.startswith('pkg_'):
            raise ValueError('tier must match packages.id format pkg_*')
        return v

class RegisterShopOut(BaseModel):
    user_id: str
    tenant_id: str
    subdomain: str
    status: str

RESERVED_SUBDOMAINS = {
    "www","api","app","admin","mail","ftp","smtp","concore","merchant",
    "platform","viiv","static","cdn","dev","staging","test","support",
    "help","blog","shop","store","pos","chat","dashboard","login",
}

@router.get("/check-subdomain")
def check_subdomain(subdomain: str, db: Session = Depends(get_db)):
    if subdomain in RESERVED_SUBDOMAINS:
        return {"available": False, "reason": "reserved"}
    taken = tenant_repo.get_tenant_by_subdomain(db, subdomain)
    return {"available": not taken}

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
        if payload.subdomain in RESERVED_SUBDOMAINS:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="subdomain reserved")
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
                package_id=payload.tier,
            )

            # ── Provision login records ──────────────────────────────────────
            # 1) viiv_accounts: ใช้สำหรับ /api/platform/login (เจ้าของร้าน)
            # 2) tenant_staff:  ใช้สำหรับ /api/staff/login (login จาก viiv.me)
            # 3) tenants.owner_id → viiv_accounts.id (เพื่อ /my-shops list ร้าน)
            hashed_pw = _pwd_ctx.hash(payload.password)
            pfu_id = "pfu_" + str(uuid.uuid4())
            db.execute(text("""
                INSERT INTO viiv_accounts (id, email, full_name, hashed_password, is_active)
                VALUES (:id, :em, :fn, :hp, true)
                ON CONFLICT (email) DO UPDATE
                  SET hashed_password = EXCLUDED.hashed_password,
                      full_name = EXCLUDED.full_name
            """), {"id": pfu_id, "em": payload.email,
                   "fn": payload.full_name, "hp": hashed_pw})
            row = db.execute(text(
                "SELECT id FROM viiv_accounts WHERE email=:em"
            ), {"em": payload.email}).fetchone()
            account_id = row[0] if row else pfu_id

            db.execute(text(
                "UPDATE tenants SET owner_id=:oid WHERE id=:tid"
            ), {"oid": account_id, "tid": t.id})

            parts = (payload.full_name or "").strip().split(" ", 1)
            stf_id = "stf_" + uuid.uuid4().hex[:12]
            db.execute(text("""
                INSERT INTO tenant_staff (
                    id, tenant_id, first_name, last_name, email, phone,
                    role, hashed_password, permissions, user_id, is_active,
                    created_at, updated_at
                ) VALUES (
                    :id, :tid, :fn, :ln, :em, :ph,
                    'owner', :hp, '{}'::jsonb, :uid, true,
                    NOW(), NOW()
                )
                ON CONFLICT DO NOTHING
            """), {"id": stf_id, "tid": t.id,
                   "fn": parts[0] if parts else "",
                   "ln": parts[1] if len(parts) > 1 else "",
                   "em": payload.email, "ph": payload.phone,
                   "hp": hashed_pw, "uid": account_id})

            db.commit()
        except IntegrityError as ie:
            db.rollback()
            msg = str(ie.orig) if hasattr(ie, 'orig') else str(ie)
            if 'package_id' in msg or 'tenants_package_id_fkey' in msg:
                raise HTTPException(status_code=400, detail=f"invalid tier: {payload.tier}")
            raise
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
