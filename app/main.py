from fastapi import FastAPI
from app.api.routers_auth import router as auth_router
from app.api.routers_users import router as users_router
from app.api.routers_orgs import router as orgs_router
from modules.module1.mini_pos.api.products import router as products_router
from modules.module1.mini_pos.api.orders import router as orders_router
from modules.module1.mini_pos.api.receipts import router as receipts_router
from modules.module1.customer_admin.api.customers import router as customers_router
from app.api.register_shop import router as register_shop_router

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}

app.include_router(auth_router, prefix="/api/auth")
app.include_router(users_router, prefix="/api/users")
app.include_router(orgs_router, prefix="/api/orgs")
app.include_router(register_shop_router, prefix="/api")

app.include_router(products_router, prefix="/api/products")
app.include_router(orders_router, prefix="/api/orders")
app.include_router(receipts_router, prefix="/api/receipts")
app.include_router(customers_router, prefix="/api/customers")
