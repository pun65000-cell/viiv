"""
modulefbchat/db.py — Thin asyncpg wrapper (identical pattern to modulefb/db.py).
Port :8006 — lightweight pool min=1 max=5.
"""
import os
import re
import logging
from typing import Any, Optional

import asyncpg
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger(__name__)

_DSN: str = os.environ["DATABASE_URL"]


def _translate(query: str, params: Optional[dict]) -> tuple[str, tuple]:
    """Translate :name placeholders → $1,$2,... (Rule 192 — no ::type)."""
    if not params:
        return query, ()
    keys = re.findall(r"(?<!:):(\w+)", query)
    ordered: list[Any] = []
    for i, k in enumerate(keys, 1):
        query = re.sub(r"(?<!:):" + k, f"${i}", query, count=1)
        ordered.append(params[k])
    return query, tuple(ordered)


class FBChatDatabase:
    def __init__(self):
        self._pool: Optional[asyncpg.Pool] = None

    async def start(self):
        self._pool = await asyncpg.create_pool(dsn=_DSN, min_size=1, max_size=5)
        log.info("FBChatDatabase pool started (min=1 max=5)")

    async def shutdown(self):
        if self._pool:
            await self._pool.close()
            self._pool = None
            log.info("FBChatDatabase pool closed")

    async def fetch_one(self, query: str, params: Optional[dict] = None) -> Optional[dict]:
        q, args = _translate(query, params)
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(q, *args)
            return dict(row) if row else None

    async def fetch_all(self, query: str, params: Optional[dict] = None) -> list[dict]:
        q, args = _translate(query, params)
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(q, *args)
            return [dict(r) for r in rows]

    async def execute(self, query: str, params: Optional[dict] = None) -> str:
        q, args = _translate(query, params)
        async with self._pool.acquire() as conn:
            return await conn.execute(q, *args)
