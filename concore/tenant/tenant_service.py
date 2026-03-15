from sqlalchemy.orm import Session
from uuid import UUID
from app.models.tenant import Tenant
from sqlalchemy import select

def create_tenant(db: Session, slug: str, owner_user_id: UUID, package: str):
    exists = db.execute(select(Tenant).where(Tenant.slug == slug)).scalar_one_or_none()
    if exists:
        return None
    t = Tenant(slug=slug, owner_user_id=owner_user_id, package=package)
    db.add(t)
    db.flush()
    return t

def get_by_slug(db: Session, slug: str):
    return db.execute(select(Tenant).where(Tenant.slug == slug)).scalar_one_or_none()

def get_by_id(db: Session, tenant_id: UUID):
    return db.execute(select(Tenant).where(Tenant.id == tenant_id)).scalar_one_or_none()
