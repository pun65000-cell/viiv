from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.organization import Organization

def create(db: Session, name: str) -> Organization:
    o = Organization(name=name)
    db.add(o)
    db.flush()
    return o

def list_orgs(db: Session, limit: int = 100, offset: int = 0):
    return db.execute(select(Organization).limit(limit).offset(offset)).scalars().all()
