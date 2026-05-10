"""
modulefb — Facebook Inbox Assistant

FastAPI application that provides browser automation infrastructure
for VIIV customers who authorize Facebook integration.

Phase 1: skeleton + health endpoint
Phase 2: BrowserPool wired into lifespan
Phase 3+: auth API, listeners, reply executor (future)
"""

# Load .env BEFORE other imports — uvicorn doesn't auto-load,
# and crypto.py reads FB_SESSION_ENCRYPTION_KEY from os.environ
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI

from .browser.pool import BrowserPool
from .db import FBDatabase
from .browser.session import FBSessionManager
from .api.connection import router as connection_router

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    modulefb lifespan — initialize DB pool, browser pool, and session
    manager on startup; clean shutdown in reverse order.
    """
    log.info("modulefb starting up")

    app.state.db = FBDatabase()
    await app.state.db.start()

    app.state.pool = BrowserPool(
        max_active_contexts=20,
        idle_timeout_seconds=1800,
    )
    await app.state.pool.start()

    app.state.session_mgr = FBSessionManager(app.state.pool, app.state.db)

    yield

    log.info("modulefb shutting down")
    await app.state.pool.shutdown()
    await app.state.db.shutdown()


app = FastAPI(
    title="VIIV modulefb",
    description="Facebook Inbox Assistant for VIIV customers",
    version="0.2.0",
    lifespan=lifespan,
)

app.include_router(connection_router, prefix="/api/fb/connection", tags=["fb-connection"])


@app.get("/health")
async def health():
    """Health check + pool stats for monitoring."""
    return {
        "status": "ok",
        "module": "modulefb",
        "version": "0.2.0",
        "pool": app.state.pool.stats(),
    }
