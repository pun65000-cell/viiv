"""
modulefbchat/client.py — fbchat-muqit wrapper for 1 tenant.

Responsibilities:
  - Load cookies from JSON file path
  - Start / stop session via async context manager
  - Listen for incoming messages (async, fires callback)
  - send_reply(thread_id, text) with human-like delay 30-120s
  - Proxy support via http_proxy param
  - On session expired → update status to 'expired' + fire on_expired callback
"""
from __future__ import annotations

import asyncio
import logging
import random
import time
from typing import Callable, Awaitable, Optional

from fbchat_muqit import Client, EventType, Message

log = logging.getLogger(__name__)


class FBChatClient:
    """Wraps a single fbchat-muqit Client for one tenant."""

    def __init__(
        self,
        tenant_id: str,
        cookies_path: str,
        on_message: Optional[Callable[[str, Message], Awaitable[None]]] = None,
        on_expired: Optional[Callable[[str], Awaitable[None]]] = None,
        http_proxy: Optional[str] = None,
    ):
        self.tenant_id = tenant_id
        self.cookies_path = cookies_path
        self._on_message = on_message
        self._on_expired = on_expired
        self._proxy = http_proxy

        self._client: Optional[Client] = None
        self._listen_task: Optional[asyncio.Task] = None
        self._connected = False
        self._last_activity = time.time()
        self._uid: str = ""

    @property
    def uid(self) -> str:
        return self._uid

    @property
    def connected(self) -> bool:
        return self._connected

    @property
    def last_activity(self) -> float:
        return self._last_activity

    async def connect(self) -> None:
        """Create session from cookies file and start listening."""
        if self._connected:
            return

        self._client = Client(
            cookies_file_path=self.cookies_path,
            proxy=self._proxy,
            log_level="WARNING",
            disable_logs=False,
        )

        try:
            await self._client.__aenter__()
        except Exception as exc:
            log.error("fbchat connect failed for %s: %s", self.tenant_id, exc)
            self._client = None
            raise

        self._uid = self._client.uid
        self._connected = True
        self._last_activity = time.time()
        log.info("fbchat connected tenant=%s uid=%s", self.tenant_id, self._uid)

        self._client.on(EventType.MESSAGE, self._handle_message)

        self._listen_task = asyncio.create_task(
            self._listen_loop(), name=f"fbchat-listen-{self.tenant_id}"
        )

    async def disconnect(self) -> None:
        """Stop listening and close session."""
        if not self._connected:
            return
        self._connected = False

        if self._listen_task and not self._listen_task.done():
            self._listen_task.cancel()
            try:
                await self._listen_task
            except asyncio.CancelledError:
                pass
        self._listen_task = None

        if self._client:
            try:
                await self._client.__aexit__(None, None, None)
            except Exception as exc:
                log.warning("fbchat disconnect error tenant=%s: %s", self.tenant_id, exc)
            self._client = None

        log.info("fbchat disconnected tenant=%s", self.tenant_id)

    async def send_reply(self, thread_id: str, text: str) -> None:
        """Send a reply with human-like delay (30-120s)."""
        if not self._connected or not self._client:
            raise RuntimeError(f"client not connected: {self.tenant_id}")

        delay = random.uniform(30, 120)
        log.info("fbchat reply delay=%.0fs tenant=%s thread=%s", delay, self.tenant_id, thread_id)
        await asyncio.sleep(delay)

        await self._client.send_message(text=text, thread_id=thread_id)
        self._last_activity = time.time()

    async def is_logged_in(self) -> bool:
        if not self._client or not self._client._state:
            return False
        return self._client._state.is_logged_in()

    async def fetch_thread_list(self, limit: int = 5):
        if not self._client:
            return []
        return await self._client.fetch_thread_list(limit=limit)

    async def _handle_message(self, event: Message) -> None:
        self._last_activity = time.time()
        log.info(
            "fbchat message tenant=%s thread=%s from=%s",
            self.tenant_id,
            getattr(event, "thread_id", "?"),
            getattr(event, "author", "?"),
        )
        if self._on_message:
            try:
                await self._on_message(self.tenant_id, event)
            except Exception as exc:
                log.error("on_message callback error tenant=%s: %s", self.tenant_id, exc)

    async def _listen_loop(self) -> None:
        try:
            await self._client.start_listening()
            while self._connected:
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            log.error("fbchat listen error tenant=%s: %s", self.tenant_id, exc)
            self._connected = False
            if self._on_expired:
                try:
                    await self._on_expired(self.tenant_id)
                except Exception:
                    pass
        finally:
            if self._client:
                try:
                    await self._client.stop_listening()
                except Exception:
                    pass
