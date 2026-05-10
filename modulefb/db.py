"""
modulefb/db.py — Thin asyncpg wrapper for Facebook Inbox Assistant.

Design:
  - asyncpg pool (min=1 max=5) — lightweight for modulefb:8005
  - Reads DATABASE_URL from .env (postgresql://... DSN — asyncpg accepts natively)
  - :name placeholder → $1,$2 translation so session.py doesn't need to change
  - CAST(:x AS type) pattern instead of ::type (Rule 192 — asyncpg/psycopg2 compat)
"""
import os
import re
import logging
from typing import Any, Optional

import asyncpg
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger(__name__)

# asyncpg accepts postgresql:// DSN directly (no need to convert to asyncpg+...)
_DSN: str = os.environ["DATABASE_URL"]


def _translate(query: str, params: Optional[dict]) -> tuple[str, tuple]:
    """
    Translate :name placeholders → $1,$2,... and dict → ordered tuple.

    Examples:
      "WHERE id = :id AND status = :status", {"id": 1, "status": "ok"}
      → "WHERE id = $1 AND status = $2", (1, "ok")

    Handles repeated keys: each occurrence gets the next positional index.
    asyncpg does not support named params — only positional.
    """
    if not params:
        return query, ()

    # (?<!:) = negative lookbehind — skip ::type PostgreSQL casts (Rule 192)
    keys = re.findall(r"(?<!:):(\w+)", query)
    ordered: list[Any] = []
    for i, k in enumerate(keys, 1):
        # Replace only single-colon occurrences (not ::)
        query = re.sub(r"(?<!:):" + k, f"${i}", query, count=1)
        ordered.append(params[k])

    return query, tuple(ordered)


class FBDatabase:
    """
    asyncpg connection pool wrapper.

    Usage:
        db = FBDatabase()
        await db.start()
        row = await db.fetch_one("SELECT 1 AS x")
        await db.shutdown()
    """

    def __init__(self):
        self._pool: Optional[asyncpg.Pool] = None

    async def start(self):
        """Create asyncpg connection pool."""
        self._pool = await asyncpg.create_pool(
            dsn=_DSN,
            min_size=1,
            max_size=5,
        )
        log.info("FBDatabase pool started (min=1 max=5)")

    async def shutdown(self):
        """Close all connections in pool."""
        if self._pool:
            await self._pool.close()
            self._pool = None
            log.info("FBDatabase pool closed")

    async def fetch_one(
        self, query: str, params: Optional[dict] = None
    ) -> Optional[dict]:
        """Return first row as dict, or None if no rows."""
        q, args = _translate(query, params)
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(q, *args)
            return dict(row) if row else None

    async def fetch_all(
        self, query: str, params: Optional[dict] = None
    ) -> list[dict]:
        """Return all rows as list of dicts."""
        q, args = _translate(query, params)
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(q, *args)
            return [dict(r) for r in rows]

    async def execute(
        self, query: str, params: Optional[dict] = None
    ) -> str:
        """Execute a statement. Returns status string (e.g. 'INSERT 0 1')."""
        q, args = _translate(query, params)
        async with self._pool.acquire() as conn:
            return await conn.execute(q, *args)

    async def executemany(
        self, query: str, params_list: list[dict]
    ) -> None:
        """Execute statement for each set of params in params_list."""
        if not params_list:
            return
        # Translate using first row to get ordered $N query
        q, _ = _translate(query, params_list[0])
        keys = re.findall(r"(?<!:):(\w+)", query)
        args_list = [tuple(p[k] for k in keys) for p in params_list]
        async with self._pool.acquire() as conn:
            await conn.executemany(q, args_list)
