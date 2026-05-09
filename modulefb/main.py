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

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    modulefb lifespan — initialize browser pool on startup,
    cleanup on shutdown.
    """
    log.info("modulefb starting up")

    app.state.pool = BrowserPool(
        max_active_contexts=20,
        idle_timeout_seconds=1800,
    )
    await app.state.pool.start()

    yield

    log.info("modulefb shutting down")
    await app.state.pool.shutdown()


app = FastAPI(
    title="VIIV modulefb",
    description="Facebook Inbox Assistant for VIIV customers",
    version="0.2.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    """Health check + pool stats for monitoring."""
    return {
        "status": "ok",
        "module": "modulefb",
        "version": "0.2.0",
        "pool": app.state.pool.stats(),
    }
