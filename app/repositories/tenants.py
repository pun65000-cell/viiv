from sqlalchemy.orm import Session
from sqlalchemy import select
from uuid import UUID
from app.models.tenant import Tenant

def create_tenant(db: Session, slug: str, name: str, owner_user_id: UUID, package: str) -> Tenant:
    t = Tenant(slug=slug, name=name, owner_user_id=owner_user_id, package=package)
    db.add(t)
    db.flush()
    return t

def get_tenant_by_slug(db: Session, slug: str) -> Tenant | None:
    return db.execute(select(Tenant).where(Tenant.slug == slug)).scalar_one_or_none()

def get_tenant_by_id(db: Session, tenant_id: UUID) -> Tenant | None:
    return db.execute(select(Tenant).where(Tenant.id == tenant_id)).scalar_one_or_none()
