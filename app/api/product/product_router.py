from fastapi import APIRouter
from modules.pos import product_service

router = APIRouter(prefix="/product", tags=["product"])


@router.post("/create")
def create_product(payload: dict):
    return product_service.create_product(payload)


@router.get("/list")
def list_products():
    return product_service.list_products()


@router.post("/get")
def get_product(payload: dict):
    return product_service.get_product(payload.get("id"))


@router.post("/update-stock")
def update_stock(payload: dict):
    return product_service.update_stock(payload.get("id"), payload.get("stock"))


@router.post("/add-media")
def add_media(payload: dict):
    return product_service.add_media(payload.get("product_id"), payload.get("type"), payload.get("url"))


@router.post("/click")
def click(payload: dict):
    return product_service.click(payload.get("product_id"))
