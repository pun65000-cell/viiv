from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.repositories import orgs as org_repo
from app.schemas.orgs import OrgCreate, OrgRead
from typing import List

router = APIRouter(tags=['orgs'])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post('/', response_model=OrgRead)
def create_org(payload: OrgCreate, db: Session = Depends(get_db)):
    o = org_repo.create(db, payload.name)
    db.commit()
    return OrgRead(id=str(o.id), name=o.name, created_at=o.created_at)

@router.get('/', response_model=List[OrgRead])
def list_orgs(db: Session = Depends(get_db)):
    items = org_repo.list_orgs(db)
    return [OrgRead(id=str(o.id), name=o.name, created_at=o.created_at) for o in items]
