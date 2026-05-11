"""DB pool for modulepool — asyncpg connection pool."""
import logging
import os

import asyncpg

logger = logging.getLogger("modulepool.db")

_DB_HOST = os.getenv("DB_HOST", "10.1.0.3")
_DB_PORT = os.getenv("DB_PORT", "5434")
_DB_NAME = os.getenv("DB_NAME", "postgres")
_DB_USER = os.getenv("DB_USER", "postgres")
_DB_PASS = os.getenv("DB_PASSWORD", "viiv_secure_123")

_DSN = f"postgresql://{_DB_USER}:{_DB_PASS}@{_DB_HOST}:{_DB_PORT}/{_DB_NAME}"


async def init_db_pool() -> asyncpg.Pool:
    """Create asyncpg pool sized for Pool Manager workload."""
    pool = await asyncpg.create_pool(
        dsn=_DSN,
        min_size=5,
        max_size=20,
        command_timeout=10.0,
        max_inactive_connection_lifetime=300.0,
    )
    async with pool.acquire() as conn:
        result = await conn.fetchval("SELECT 1")
        if result != 1:
            raise RuntimeError("DB smoke test failed")
    logger.info("DB pool ready: %s:%s/%s", _DB_HOST, _DB_PORT, _DB_NAME)
    return pool


async def close_db_pool(pool: asyncpg.Pool) -> None:
    if pool:
        await pool.close()


def get_db_pool(request) -> asyncpg.Pool:
    return request.app.state.db
