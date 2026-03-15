from fastapi import APIRouter, status
from pydantic import BaseModel

router = APIRouter()

class ProductIn(BaseModel):
    name: str
    price: float

@router.get("")
def list_products():
    return []

@router.post("", status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductIn):
    return {"id": "tmp", "name": payload.name, "price": payload.price}
