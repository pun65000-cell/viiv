from fastapi import APIRouter, status
from pydantic import BaseModel
from modules.module1.mini_pos.services import medusa_pos_service

router = APIRouter()

class ProductIn(BaseModel):
    name: str
    price: float

@router.get("")
def list_products():
    return medusa_pos_service.list_products()

@router.post("", status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductIn):
    return {"id": "tmp", "name": payload.name, "price": payload.price}
