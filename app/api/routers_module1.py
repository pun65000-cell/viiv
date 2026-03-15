from fastapi import APIRouter
from modules.module1.customer_admin.api.customers import router as customers_router
from modules.module1.mini_pos.api.orders import router as orders_router
from modules.module1.mini_pos.api.receipts import router as receipts_router
from modules.module1.owner_panel.api.panel import router as owner_panel_router

router = APIRouter()
router.include_router(customers_router, prefix="/api")
router.include_router(orders_router, prefix="/api")
router.include_router(receipts_router, prefix="/api")
router.include_router(owner_panel_router)
