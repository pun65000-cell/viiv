# Rule 279: load_dotenv() BEFORE other imports
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from contextlib import asynccontextmanager
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logging.getLogger("modulefbchat").setLevel(logging.INFO)

from fastapi import FastAPI

from .db import FBChatDatabase
from .manager import FBChatManager
from .poll_loop import start_poll_loop, stop_poll_loop
from .api.health import router as health_router
from .api.session import router as session_router
from .api.smoketest import router as smoketest_router
from .api.poll import router as poll_router

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("modulefbchat starting up on :8006")

    # Rule 353: app.state pattern — no module-level instances
    app.state.db = FBChatDatabase()
    await app.state.db.start()

    app.state.manager = FBChatManager()
    await app.state.manager.start()

    await start_poll_loop()

    yield

    log.info("modulefbchat shutting down")
    await stop_poll_loop()
    await app.state.manager.shutdown()
    await app.state.db.shutdown()


app = FastAPI(
    title="VIIV modulefbchat",
    description="Facebook Chat API (fbchat-muqit) — multi-tenant POC",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(health_router)
app.include_router(session_router, prefix="/api/fbchat", tags=["fbchat-session"])
app.include_router(smoketest_router, prefix="/api/fbchat", tags=["fbchat-smoketest"])
app.include_router(poll_router, prefix="/api/fbchat", tags=["fbchat-poll"])
