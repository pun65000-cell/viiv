from fastapi import APIRouter, status
from pydantic import BaseModel
from modules.module1.mini_pos.services import medusa_pos_service

router = APIRouter()

class OrderIn(BaseModel):
    items: list[dict]

@router.get("")
def list_orders():
    return []

@router.post("", status_code=status.HTTP_201_CREATED)
def create_order(payload: OrderIn):
    return medusa_pos_service.create_order(payload.items)
