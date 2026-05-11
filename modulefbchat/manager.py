"""
modulefbchat/manager.py — Multi-tenant FBChatClient pool.

Rules:
  - max 20 concurrent clients
  - idle 30 min → auto-disconnect
  - reconnect on next activity
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Callable, Awaitable, Dict, Optional

from .client import FBChatClient

log = logging.getLogger(__name__)

MAX_CLIENTS = 20
IDLE_TIMEOUT = 1800  # 30 min


class FBChatManager:
    def __init__(self):
        self._clients: Dict[str, FBChatClient] = {}
        self._reaper_task: Optional[asyncio.Task] = None
        self._on_message: Optional[Callable] = None
        self._on_expired: Optional[Callable] = None

    def set_message_callback(self, cb: Callable[[str, object], Awaitable[None]]) -> None:
        self._on_message = cb

    def set_expired_callback(self, cb: Callable[[str], Awaitable[None]]) -> None:
        self._on_expired = cb

    async def start(self) -> None:
        self._reaper_task = asyncio.create_task(self._idle_reaper(), name="fbchat-reaper")
        log.info("FBChatManager started (max=%d idle=%ds)", MAX_CLIENTS, IDLE_TIMEOUT)

    async def shutdown(self) -> None:
        if self._reaper_task:
            self._reaper_task.cancel()
            try:
                await self._reaper_task
            except asyncio.CancelledError:
                pass

        tenant_ids = list(self._clients.keys())
        for tid in tenant_ids:
            await self._disconnect(tid)
        log.info("FBChatManager shutdown complete")

    async def connect(self, tenant_id: str, cookies_path: str, http_proxy: Optional[str] = None) -> FBChatClient:
        """Connect or return existing connected client for tenant."""
        if tenant_id in self._clients and self._clients[tenant_id].connected:
            return self._clients[tenant_id]

        if len(self._clients) >= MAX_CLIENTS:
            await self._evict_oldest_idle()

        client = FBChatClient(
            tenant_id=tenant_id,
            cookies_path=cookies_path,
            on_message=self._on_message,
            on_expired=self._handle_expired,
            http_proxy=http_proxy,
        )
        await client.connect()
        self._clients[tenant_id] = client
        return client

    async def disconnect(self, tenant_id: str) -> None:
        await self._disconnect(tenant_id)

    def get_client(self, tenant_id: str) -> Optional[FBChatClient]:
        return self._clients.get(tenant_id)

    def status(self, tenant_id: str) -> dict:
        client = self._clients.get(tenant_id)
        if not client:
            return {"connected": False, "uid": None}
        return {
            "connected": client.connected,
            "uid": client.uid,
            "idle_seconds": int(time.time() - client.last_activity),
        }

    def all_statuses(self) -> dict:
        return {tid: self.status(tid) for tid in self._clients}

    def stats(self) -> dict:
        active = sum(1 for c in self._clients.values() if c.connected)
        return {"active": active, "total": len(self._clients), "max": MAX_CLIENTS}

    async def _disconnect(self, tenant_id: str) -> None:
        client = self._clients.pop(tenant_id, None)
        if client:
            await client.disconnect()

    async def _handle_expired(self, tenant_id: str) -> None:
        log.warning("fbchat session expired tenant=%s — removing", tenant_id)
        self._clients.pop(tenant_id, None)
        if self._on_expired:
            try:
                await self._on_expired(tenant_id)
            except Exception as exc:
                log.error("expired callback error: %s", exc)

    async def _idle_reaper(self) -> None:
        while True:
            try:
                await asyncio.sleep(60)
                now = time.time()
                idle_tenants = [
                    tid for tid, c in self._clients.items()
                    if c.connected and (now - c.last_activity) > IDLE_TIMEOUT
                ]
                for tid in idle_tenants:
                    log.info("fbchat idle timeout tenant=%s — disconnecting", tid)
                    await self._disconnect(tid)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                log.error("idle reaper error: %s", exc)

    async def _evict_oldest_idle(self) -> None:
        if not self._clients:
            return
        oldest = min(self._clients.values(), key=lambda c: c.last_activity)
        log.warning("fbchat pool full — evicting oldest tenant=%s", oldest.tenant_id)
        await self._disconnect(oldest.tenant_id)
