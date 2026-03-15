from fastapi import APIRouter, status
from pydantic import BaseModel, EmailStr

router = APIRouter()

class CustomerIn(BaseModel):
    email: EmailStr
    name: str | None = None

@router.get("")
def list_customers():
    return []

@router.post("", status_code=status.HTTP_201_CREATED)
def create_customer(payload: CustomerIn):
    return {"id": "tmp", "email": payload.email, "name": payload.name}
