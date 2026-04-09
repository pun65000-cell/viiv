from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.sql import func, text
from app.core.database import Base

class Tenant(Base):
    __tablename__ = 'tenants'
    id            = Column(String, primary_key=True, server_default=text("generate_prefixed_uuid('ten_')"))
    full_name     = Column(String(255))
    email         = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255))
    phone         = Column(String(20))
    store_name    = Column(String(255))
    subdomain     = Column(String(100), unique=True, nullable=False)
    status        = Column(String(20), default='pending')
    accepted_terms= Column(Boolean, default=False)
    accepted_at   = Column(DateTime(timezone=True))
    user_agent    = Column(Text)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now())
