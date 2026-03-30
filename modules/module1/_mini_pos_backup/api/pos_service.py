from sqlalchemy.orm import Session
from uuid import UUID
from modules.module1.models import Order, OrderItem, Product, Receipt
from datetime import datetime

def create_order(db: Session, tenant_id: UUID, customer_id: UUID | None = None) -> Order:
    o = Order(tenant_id=tenant_id, customer_id=customer_id, total=0)
    db.add(o)
    db.flush()
    return o

def add_product_to_order(db: Session, tenant_id: UUID, order_id: UUID, product_id: UUID, quantity: int, unit_price: float | None = None) -> OrderItem:
    p = db.get(Product, product_id)
    if not p or getattr(p, "tenant_id") != tenant_id:
        return None
    up = unit_price if unit_price is not None else float(p.price)
    oi = OrderItem(order_id=order_id, product_id=product_id, tenant_id=tenant_id, quantity=quantity, unit_price=up)
    db.add(oi)
    db.flush()
    return oi

def calculate_total(db: Session, order: Order) -> float:
    items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    total = sum(i.quantity * float(i.unit_price) for i in items)
    order.total = total
    db.flush()
    return float(total)

def generate_receipt(db: Session, tenant_id: UUID, order_id: UUID) -> Receipt:
    r = Receipt(order_id=order_id, tenant_id=tenant_id, issued_at=datetime.utcnow())
    db.add(r)
    db.flush()
    return r
