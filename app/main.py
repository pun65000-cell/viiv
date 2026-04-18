from dotenv import load_dotenv
from app.api.pos_products import router as pos_products_router
from app.api.tenant_staff import router as tenant_staff_router
import os
import uuid

load_dotenv()
from fastapi import FastAPI
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.sessions import SessionMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.auth_social import router as auth_social_router
from app.api.routers_users import router as users_router
from app.api.routers_orgs import router as orgs_router
# from modules.legacy.mini_pos.api.products import router as products_router
# from modules.legacy.mini_pos.api.orders import router as orders_router
# from modules.legacy.mini_pos.api.receipts import router as receipts_router
from modules.legacy.customer_admin.api.customers import router as customers_router
from app.api.register_shop import router as register_shop_router
from modules.pos.pos_router import router as pos_router
from app.api.cart.cart_router import router as cart_router
from app.api.cart.cart_router import order_router
from app.api.product.product_router import router as product_router
from app.api.admin_auth import router as admin_auth_router
from app.api.pos_admin import router as pos_admin_router
from app.api.stores import router as stores_router
from app.api.login import router as login_router
from app.api.routers_pos_merchant import router as pos_merchant_router
from app.core.id import gen_id
from modules.event_bus.event_bus import set_req_id, clear_req_id
# from app.api.upload import router as upload_router
from app.api.track import router as track_router
from app.api.chat import router as chat_router

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
SESSION_SECRET = os.getenv("SESSION_SECRET", "dev-secret")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://viiv.me",
        "https://www.viiv.me",
        "https://merchant.viiv.me",
        "https://concore.viiv.me"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

os.makedirs("/home/viivadmin/viiv/uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="/home/viivadmin/viiv/uploads"), name="uploads")
app.mount("/merchant", StaticFiles(directory="/home/viivadmin/viiv/modules/pos/merchant/ui/dashboard"), name="merchant")

_debug_req_logs = os.getenv("DEBUG_REQ_LOGS") == "1"

@app.middleware("http")
async def attach_req_id(request: Request, call_next):
    req_id = gen_id("req")
    request.state.req_id = req_id
    set_req_id(req_id)
    if _debug_req_logs:
        print({"req": req_id, "method": request.method, "path": request.url.path})
    response = await call_next(request)
    if _debug_req_logs:
        print({"req": req_id, "status": getattr(response, "status_code", None)})
    clear_req_id()
    return response

app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET
)

# DevAuthMiddleware removed — was injecting fake auth on every request

@app.middleware("http")
async def inject_tenant(request: Request, call_next):
    tenant_id = None

    host = request.headers.get("host")
    if host:
        host = host.split(":")[0]
    if host and "viiv.me" in host:
        subdomain = host.split(".")[0]
        if subdomain:
            tenant_id = subdomain

    if not tenant_id:
        tenant_id = request.headers.get("X-Tenant")

    if not tenant_id:
        tenant_id = request.query_params.get("tenant_id")

    if not tenant_id:
        tenant_id = "default"

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


from collections import defaultdict
import time as _time

_rate_store = defaultdict(list)
_RATE_LIMIT = 100  # requests
_RATE_WINDOW = 60  # seconds

@app.middleware("http")
async def rate_limiter(request: Request, call_next):
    # ข้าม static files
    if request.url.path.startswith('/merchant') or request.url.path.startswith('/uploads'):
        return await call_next(request)
    ip = request.client.host if request.client else 'unknown'
    now = _time.time()
    _rate_store[ip] = [t for t in _rate_store[ip] if now-t < _RATE_WINDOW]
    if len(_rate_store[ip]) >= _RATE_LIMIT:
        from fastapi.responses import JSONResponse
        return JSONResponse({"detail":"Too many requests"},status_code=429)
    _rate_store[ip].append(now)
    return await call_next(request)

@app.get("/health")
def health():
    return {"status": "ok"}

app.include_router(login_router)
app.include_router(users_router, prefix="/api/users")
app.include_router(orgs_router, prefix="/api/orgs")
app.include_router(register_shop_router, prefix="/api")
app.include_router(stores_router)
app.include_router(pos_merchant_router)

# app.include_router(products_router, prefix="/api/products")
# app.include_router(orders_router, prefix="/api/orders")
# app.include_router(receipts_router, prefix="/api/receipts")
app.include_router(pos_router)
app.include_router(cart_router)
app.include_router(order_router)
app.include_router(product_router)
app.include_router(pos_admin_router)
try:
    from app.api.upload import router as upload_router  # noqa: F401
    app.include_router(upload_router)
except Exception:
    pass
app.include_router(track_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(auth_social_router)
app.include_router(admin_auth_router)
app.include_router(tenant_staff_router)
app.include_router(pos_products_router)
app.include_router(customers_router, prefix="/api/customers")
from app.api.pos_bills import router as pos_bills_router
from app.api.pos_members import router as pos_members_router
app.include_router(pos_bills_router)
app.include_router(pos_members_router)
from app.api.pos_store import router as pos_store_router
app.include_router(pos_store_router)
from app.api.pos_affiliate import router as pos_affiliate_router
app.include_router(pos_affiliate_router)
