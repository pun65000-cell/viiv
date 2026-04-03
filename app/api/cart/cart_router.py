from fastapi import APIRouter
from modules.pos import cart_service as pos_cart_service
from modules.pos import order_service as pos_order_service

router = APIRouter(prefix="/cart", tags=["cart"])
order_router = APIRouter(prefix="/order", tags=["order"])


@router.post("/create")
def create_cart():
    return pos_cart_service.create_cart()


@router.post("/add-item")
def add_item(payload: dict):
    return pos_cart_service.add_item(payload)


@router.post("/get")
def get_cart(payload: dict):
    return pos_cart_service.get_cart(payload)


@order_router.post("/checkout")
def checkout(payload: dict):
    return pos_order_service.checkout(payload)


@order_router.post("/confirm-payment")
def confirm_payment(payload: dict):
    return pos_order_service.confirm_payment(payload)


@order_router.get("/list")
def list_orders():
    return pos_order_service.list_orders()


@order_router.post("/receipt")
def generate_receipt(payload: dict):
    return pos_order_service.receipt(payload)
