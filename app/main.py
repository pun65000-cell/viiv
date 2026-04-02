from dotenv import load_dotenv
import os

load_dotenv()
from fastapi import FastAPI
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from app.api.auth_social import router as auth_social_router
import os
from app.api.routers_auth import router as auth_router
from app.api.routers_users import router as users_router
from app.api.routers_orgs import router as orgs_router
# from modules.module1.mini_pos.api.products import router as products_router
# from modules.module1.mini_pos.api.orders import router as orders_router
# from modules.module1.mini_pos.api.receipts import router as receipts_router
from modules.module1.customer_admin.api.customers import router as customers_router
from app.api.register_shop import router as register_shop_router
from modules.pos.pos_router import router as pos_router
from app.api.cart.cart_router import router as cart_router
from app.api.cart.cart_router import order_router
from app.api.product.product_router import router as product_router
from app.api.admin_auth import router as admin_auth_router

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
SESSION_SECRET = os.getenv("SESSION_SECRET", "dev-secret")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://viiv.me",
        "https://www.viiv.me",
        "https://owner.viiv.me",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
)

@app.middleware("http")
async def inject_tenant(request: Request, call_next):
    tenant_id = None

    host = request.headers.get("host")
    if host:
        host = host.split(":")[0]
    print("DEBUG_HOST:", host)
    if host and "viiv.me" in host:
        subdomain = host.split(".")[0]
        if subdomain:
            tenant_id = subdomain
    print("DEBUG_AFTER_DOMAIN:", tenant_id)

    if not tenant_id:
        tenant_id = request.headers.get("X-Tenant")
    print("DEBUG_AFTER_HEADER:", tenant_id)

    if not tenant_id:
        tenant_id = request.query_params.get("tenant_id")
    print("DEBUG_AFTER_QUERY:", tenant_id)

    if not tenant_id:
        tenant_id = "default"
    print("FINAL_TENANT:", tenant_id)

    request.state.tenant_id = tenant_id

    response = await call_next(request)
    return response

shops = {}

@app.on_event("startup")
def ensure_default_shop():
    if "main_shop" not in shops:
        shops["main_shop"] = {
            "id": "main_shop",
            "slug": "shop",
            "domain": "shop.viiv.me",
        }

@app.get("/health")
def health():
    return {"status": "ok"}

app.include_router(auth_router, prefix="/api/auth")
app.include_router(users_router, prefix="/api/users")
app.include_router(orgs_router, prefix="/api/orgs")
app.include_router(register_shop_router, prefix="/api")

# app.include_router(products_router, prefix="/api/products")
# app.include_router(orders_router, prefix="/api/orders")
# app.include_router(receipts_router, prefix="/api/receipts")
app.include_router(pos_router)
app.include_router(cart_router)
app.include_router(order_router)
app.include_router(product_router)
app.include_router(auth_social_router)
app.include_router(admin_auth_router)
app.include_router(customers_router, prefix="/api/customers")
