from sqlalchemy.orm import Session
from app.models.tenant import Tenant

def get_tenant_by_subdomain(db: Session, subdomain: str):
    return db.query(Tenant).filter(Tenant.subdomain == subdomain).first()

def get_tenant_by_email(db: Session, email: str):
    return db.query(Tenant).filter(Tenant.email == email).first()

def create_tenant(db: Session, full_name: str, email: str, store_name: str,
                  subdomain: str, phone: str, status: str):
    db_tenant = Tenant(
        full_name=full_name,
        email=email,
        store_name=store_name,
        subdomain=subdomain,
        phone=phone,
        status=status,
    )
    db.add(db_tenant)
    db.flush()
    return db_tenant
