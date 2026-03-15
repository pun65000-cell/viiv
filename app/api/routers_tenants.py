from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.schemas.tenant import TenantCreate, TenantResponse
from app.repositories import tenants as tenant_repo
from app.services import tenants as tenant_service

router = APIRouter(prefix='/tenants', tags=['tenants'])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post('/', response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
def create(payload: TenantCreate, db: Session = Depends(get_db)):
    t = tenant_service.create_tenant(db, payload.slug, payload.name, payload.owner_user_id, payload.package)
    if not t:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT)
    db.commit()
    return TenantResponse(id=t.id, slug=t.slug, name=t.name, owner_user_id=t.owner_user_id, package=t.package, created_at=t.created_at)

@router.get('/{slug}', response_model=TenantResponse)
def get_by_slug(slug: str, db: Session = Depends(get_db)):
    t = tenant_repo.get_tenant_by_slug(db, slug)
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return TenantResponse(id=t.id, slug=t.slug, name=t.name, owner_user_id=t.owner_user_id, package=t.package, created_at=t.created_at)
