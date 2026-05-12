"""SessionManager — spawn/destroy Firefox+Squid containers."""
import asyncio
import logging
import os
import secrets
import subprocess
from datetime import datetime, timedelta, timezone
from typing import Optional

from .models import SessionInfo

logger = logging.getLogger("modulecookie.manager")

SESSION_TTL_SECONDS = 600  # 10 minutes
SPAWN_SCRIPT = os.path.join(os.path.dirname(__file__), "scripts", "spawn-session.sh")
DESTROY_SCRIPT = os.path.join(os.path.dirname(__file__), "scripts", "destroy-session.sh")
BASE_BROWSER_URL = os.environ.get("COOKIE_BROWSER_BASE_URL", "https://dev7.viiv.me/browser")


class SessionManager:
    def __init__(self):
        self._active: Optional[SessionInfo] = None
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------
    async def start_session(self, tenant_id: str) -> SessionInfo:
        async with self._lock:
            if self._active is not None:
                if datetime.now(timezone.utc) < self._active.expires_at:
                    if self._active.tenant_id == tenant_id:
                        return self._active
                    raise RuntimeError("another session is already active")
                await self._destroy_locked(self._active.session_id)

            session_id = secrets.token_hex(16)
            now = datetime.now(timezone.utc)
            info = SessionInfo(
                session_id=session_id,
                tenant_id=tenant_id,
                started_at=now,
                expires_at=now + timedelta(seconds=SESSION_TTL_SECONDS),
            )
            await asyncio.to_thread(self._spawn, session_id)
            self._active = info
            logger.info("session started: %s tenant=%s", session_id, tenant_id)
            return info

    # ------------------------------------------------------------------
    async def destroy_session(self, session_id: str) -> None:
        async with self._lock:
            if self._active is None or self._active.session_id != session_id:
                raise KeyError(f"session {session_id} not found")
            await self._destroy_locked(session_id)

    # ------------------------------------------------------------------
    async def get_status(self) -> dict:
        async with self._lock:
            if self._active is None:
                return {"alive": False}
            now = datetime.now(timezone.utc)
            if now >= self._active.expires_at:
                await self._destroy_locked(self._active.session_id)
                return {"alive": False}
            age = int((now - self._active.started_at).total_seconds())
            return {
                "alive": True,
                "session_id": self._active.session_id,
                "tenant_id": self._active.tenant_id,
                "age_seconds": age,
            }

    # ------------------------------------------------------------------
    def get_browser_url(self, session_id: str) -> str:
        return f"{BASE_BROWSER_URL}/{session_id}/"

    # ------------------------------------------------------------------
    async def _destroy_locked(self, session_id: str) -> None:
        await asyncio.to_thread(self._destroy, session_id)
        self._active = None
        logger.info("session destroyed: %s", session_id)

    def _spawn(self, session_id: str) -> None:
        result = subprocess.run(
            ["bash", SPAWN_SCRIPT, session_id],
            capture_output=True, text=True, timeout=60,
        )
        if result.returncode != 0:
            raise RuntimeError(f"spawn failed: {result.stderr[:400]}")

    def _destroy(self, session_id: str) -> None:
        subprocess.run(
            ["bash", DESTROY_SCRIPT, session_id],
            capture_output=True, text=True, timeout=30,
        )

    # ------------------------------------------------------------------
    async def cleanup_loop(self) -> None:
        """Background task: auto-destroy expired sessions."""
        while True:
            await asyncio.sleep(60)
            async with self._lock:
                if self._active and datetime.now(timezone.utc) >= self._active.expires_at:
                    sid = self._active.session_id
                    await self._destroy_locked(sid)
                    logger.info("auto-cleanup expired session %s", sid)
