from pydantic import BaseModel
from datetime import datetime

class OrgCreate(BaseModel):
    name: str

class OrgRead(BaseModel):
    id: str
    name: str
    created_at: datetime
