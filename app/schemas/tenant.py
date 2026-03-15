from pydantic import BaseModel, constr
from datetime import datetime
from uuid import UUID

class TenantCreate(BaseModel):
    slug: constr(strip_whitespace=True, to_lower=True, min_length=3, max_length=100)
    name: constr(strip_whitespace=True, min_length=1, max_length=255)
    owner_user_id: UUID
    package: constr(strip_whitespace=True, min_length=1, max_length=50) = 'standard'

class TenantResponse(BaseModel):
    id: UUID
    slug: str
    name: str
    owner_user_id: UUID
    package: str
    created_at: datetime
