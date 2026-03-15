from fastapi import APIRouter, status
from pydantic import BaseModel

router = APIRouter()

class OrderIn(BaseModel):
    items: list[dict]

@router.get("")
def list_orders():
    return []

@router.post("", status_code=status.HTTP_201_CREATED)
def create_order(payload: OrderIn):
    return {"id": "tmp", "total": 0}
