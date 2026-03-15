from pydantic import BaseModel, EmailStr
from datetime import datetime

class UserRead(BaseModel):
    id: str
    email: EmailStr
    created_at: datetime
