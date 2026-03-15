from sqlalchemy.orm import Session
from uuid import UUID
from app.repositories import tenants as tenant_repo

def create_tenant(db: Session, slug: str, name: str, owner_user_id: UUID, package: str):
    if tenant_repo.get_tenant_by_slug(db, slug):
        return None
    t = tenant_repo.create_tenant(db, slug=slug, name=name, owner_user_id=owner_user_id, package=package)
    return t
