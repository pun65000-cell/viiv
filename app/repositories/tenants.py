from sqlalchemy import text
from sqlalchemy.orm import Session
from app.models.tenant import Tenant

def get_tenant_by_subdomain(db: Session, subdomain: str):
    return db.query(Tenant).filter(Tenant.subdomain == subdomain).first()

def get_tenant_by_email(db: Session, email: str):
    return db.query(Tenant).filter(Tenant.email == email).first()

def create_tenant(db: Session, full_name: str, email: str, store_name: str,
                  subdomain: str, phone: str, status: str,
                  package_id: str | None = None):
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
    # package_id is not on the ORM model (DB has DEFAULT 'pkg_basic' + FK).
    # Setting via post-flush UPDATE preserves DB default when None,
    # and matches the same pattern used for owner_id in register_shop.py.
    if package_id is not None:
        db.execute(
            text("UPDATE tenants SET package_id=:pid WHERE id=:tid"),
            {"pid": package_id, "tid": db_tenant.id},
        )
    return db_tenant
