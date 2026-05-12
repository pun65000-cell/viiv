"""modulecookie FastAPI service — Phase F.B."""
import asyncio
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv("/home/viivadmin/viiv/.env")

from fastapi import FastAPI

from .manager import SessionManager
from .api.health import router as health_router
from .api.session import router as session_router
from .api.verify import router as verify_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger("modulecookie.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    manager = SessionManager()
    app.state.manager = manager
    cleanup_task = asyncio.create_task(manager.cleanup_loop())
    logger.info("modulecookie service started")
    try:
        yield
    finally:
        cleanup_task.cancel()
        status = await manager.get_status()
        if status["alive"]:
            try:
                await manager.destroy_session(status["session_id"])
            except Exception:
                pass
        logger.info("modulecookie service stopped")


app = FastAPI(title="VIIV Cookie Module", version="0.1.0-fb", lifespan=lifespan)

app.include_router(health_router, prefix="/cookie")
app.include_router(session_router, prefix="/cookie")
app.include_router(verify_router, prefix="/cookie")
