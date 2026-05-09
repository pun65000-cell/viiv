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
from app.api.platform_ai import router as platform_ai_router
from app.api.platform_ai_brain import router as platform_ai_brain_router
from app.api.api_gateway import router as api_gateway_router
from modules.pos.pos_router import router as pos_router
from app.api.cart.cart_router import router as cart_router
from app.api.cart.cart_router import order_router
from app.api.product.product_router import router as product_router
from app.api.admin_auth import router as admin_auth_router
from app.api.platform_connections import router as platform_connections_router
from app.api.billing import router as billing_router
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
    allow_origin_regex=r"https://([a-z0-9-]+\.)?viiv\.me$",
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

RESERVED_SUBDOMAINS = {"concore", "auth", "www", "api", "owner", "merchant", "viiv"}

from time import time as _now
_SUBDOMAIN_CACHE_TTL = 60  # seconds
_subdomain_tenant_cache: dict[str, tuple[str | None, float]] = {}
# value = (tenant_id_or_None, expire_at)


def _get_cached_tenant(sub: str):
    """Return (hit, tenant_id). hit=False means cache miss/expired."""
    entry = _subdomain_tenant_cache.get(sub)
    if not entry:
        return False, None
    tenant_id, expire_at = entry
    if _now() > expire_at:
        _subdomain_tenant_cache.pop(sub, None)
        return False, None
    return True, tenant_id


def _set_cached_tenant(sub: str, tenant_id: str | None):
    _subdomain_tenant_cache[sub] = (tenant_id, _now() + _SUBDOMAIN_CACHE_TTL)


def _clear_cached_tenant(sub: str) -> bool:
    return _subdomain_tenant_cache.pop(sub, None) is not None


def _resolve_tenant_from_subdomain(subdomain: str) -> str | None:
    hit, tid = _get_cached_tenant(subdomain)
    if hit:
        return tid
    try:
        from app.core.db import SessionLocal
        from sqlalchemy import text as _sql_text
        with SessionLocal() as db:
            row = db.execute(
                _sql_text("SELECT id FROM tenants WHERE subdomain = :s LIMIT 1"),
                {"s": subdomain},
            ).first()
            tid = row[0] if row else None
    except Exception:
        tid = None
    _set_cached_tenant(subdomain, tid)
    return tid


# Register billing_guard BEFORE inject_tenant in source order.
# Starlette insert(0) semantics → first registered = innermost; we want
# inject_tenant to run BEFORE billing_guard on request, so inject_tenant
# is registered AFTER billing_guard (below).
from app.middleware.billing_guard import billing_guard_middleware
app.middleware("http")(billing_guard_middleware)


@app.middleware("http")
async def inject_tenant(request: Request, call_next):
    tenant_id = None

    host = request.headers.get("host", "")
    if host:
        host = host.split(":")[0].lower()

    if host.endswith(".viiv.me"):
        subdomain = host.split(".")[0]
        if subdomain and subdomain not in RESERVED_SUBDOMAINS:
            tenant_id = _resolve_tenant_from_subdomain(subdomain)

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


@app.on_event("startup")
def _start_billing_scheduler():
    if os.getenv("BILLING_SCHEDULER_ENABLED", "1") != "1":
        return
    from app.scheduler.billing_scheduler import start_scheduler
    start_scheduler()


@app.on_event("shutdown")
def _stop_billing_scheduler():
    try:
        from app.scheduler.billing_scheduler import stop_scheduler
        stop_scheduler()
    except Exception:
        pass


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
app.include_router(platform_connections_router, prefix="/api/platform")
app.include_router(billing_router, prefix="/api/platform/billing")
from app.api.platform_packages import router as platform_packages_router
app.include_router(platform_packages_router, prefix="/api/platform/packages")
from app.api.platform_modules import router as platform_modules_router
app.include_router(platform_modules_router, prefix="/api/platform")
from app.api.platform_bank import router as platform_bank_router
app.include_router(platform_bank_router, prefix="/api/platform")
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
from app.api.pos_dashboard import router as pos_dashboard_router
app.include_router(pos_dashboard_router)
from app.api.pos_categories import router as pos_categories_router
app.include_router(pos_categories_router)

from app.api import pos_partners
from app.api.pos_statements import router as statements_router
from app.api import pos_finance
app.include_router(pos_partners.router)
from app.api import pos_receive
from app.api import pos_line
from app.api import pos_bank
from modulechat.api import routes as chat_routes
from modulepost.api import routes as post_routes
from modulpos.api import routes as posm_routes
from modulepost.api import routes as post_routes
from app.api import pos_line_settings
app.include_router(pos_receive.router)
app.include_router(pos_line.router, prefix="/api/line")
app.include_router(pos_line_settings.router, prefix="/api/pos/line")
app.include_router(pos_bank.router, prefix="/api/pos/bank")
app.include_router(chat_routes.router, prefix="/api/chat")
app.include_router(posm_routes.router)
app.include_router(post_routes.router, prefix="/api/post")
app.include_router(statements_router)
app.include_router(pos_finance.router)
app.include_router(platform_ai_router, prefix="/api/platform")
app.include_router(platform_ai_brain_router, prefix="/api/platform")
app.include_router(api_gateway_router, prefix="/api/platform")
from app.api.tenant_settings import router as tenant_settings_router
app.include_router(tenant_settings_router)
from app.api.tenant_credits import router as tenant_credits_router
app.include_router(tenant_credits_router, prefix="/api/tenant/credits", tags=["tenant-credits"])
