"""VIIV Pool Manager :8010 — skeleton (Phase C.2)"""
import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv("/home/viivadmin/viiv/.env")

from fastapi import FastAPI

from .db import init_db_pool, close_db_pool
from .api import health

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger("modulepool")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("modulepool starting...")

    pool = await init_db_pool()
    app.state.db = pool
    logger.info("DB pool initialized (min=5 max=20)")

    # Phase C.3: PoolManager state + background scorer
    # Phase C.4: background scheduler + request_slot endpoint

    logger.info("modulepool ready on :8010")
    yield

    logger.info("modulepool shutting down...")
    await close_db_pool(pool)
    logger.info("modulepool stopped")


app = FastAPI(
    title="VIIV Pool Manager",
    version="0.1.0-c2",
    lifespan=lifespan,
)

app.include_router(health.router)


@app.get("/")
async def root():
    return {
        "service": "modulepool",
        "version": "0.1.0-c2",
        "status": "skeleton",
        "phase": "C.2",
    }
