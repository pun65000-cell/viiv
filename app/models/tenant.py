from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.core.database import Base

class Tenant(Base):
    __tablename__ = 'tenants'

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255))
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255))
    phone = Column(String(20))
    store_name = Column(String(255))
    subdomain = Column(String(100), unique=True, nullable=False)
    status = Column(String(20), default='pending')
    accepted_terms = Column(Boolean, default=True)
    accepted_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
