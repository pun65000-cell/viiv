"""
Browser automation pool for VIIV Facebook Inbox Assistant.

Why this design:
  - Multiple VIIV customers need browser automation in parallel
  - Each customer's data must be isolated (separate context + profile)
  - Memory must be bounded (multi-tenant predictability)
  - One Chromium binary shared across contexts = lower total memory

Lifecycle:
  - Pool starts: launch Playwright runtime, spawn cleanup loop
  - Customer activity: get/create their isolated context (lazy)
  - Idle (30 min): close customer's context (free memory)
  - Pool shutdown: close all contexts, stop Playwright
"""
import asyncio
import logging
import time
from pathlib import Path
from typing import Dict, Optional

from patchright.async_api import (
    BrowserContext,
    Playwright,
    async_playwright,
)

log = logging.getLogger(__name__)


PROFILE_BASE_DIR = Path(
    "/home/viivadmin/viiv/uploads/fb_profiles"
)


class BrowserPool:
    """
    Manages Playwright browser automation for VIIV customers.

    Public API:
      await pool.start()
      context = await pool.get_context(tenant_id, storage_state=...)
      await pool.close_context(tenant_id)
      await pool.shutdown()
      pool.stats() -> dict
    """

    def __init__(
        self,
        max_active_contexts: int = 20,
        idle_timeout_seconds: int = 1800,  # 30 minutes
    ):
        self.max_active = max_active_contexts
        self.idle_timeout = idle_timeout_seconds

        self._semaphore: Optional[asyncio.Semaphore] = None
        self._playwright: Optional[Playwright] = None
        self._contexts: Dict[str, BrowserContext] = {}
        self._last_active: Dict[str, float] = {}
        self._cleanup_task: Optional[asyncio.Task] = None
        self._started = False

    async def start(self):
        """Initialize Playwright + start idle-cleanup loop."""
        if self._started:
            return

        PROFILE_BASE_DIR.mkdir(parents=True, exist_ok=True)

        self._semaphore = asyncio.Semaphore(self.max_active)
        self._playwright = await async_playwright().start()
        self._cleanup_task = asyncio.create_task(
            self._cleanup_idle_loop()
        )
        self._started = True
        log.info("BrowserPool started")

    async def get_context(
        self,
        tenant_id: str,
        storage_state: Optional[dict] = None,
    ) -> BrowserContext:
        """
        Get or create isolated browser context for a customer.

        Args:
          tenant_id: VIIV customer ID
          storage_state: customer's authorized session
                         (None = fresh context for first login)

        Returns:
          BrowserContext that this customer's automation uses.
          Persists between calls; auto-closed after idle timeout.
        """
        if not self._started:
            raise RuntimeError("BrowserPool not started")

        # Reuse existing context if open
        if tenant_id in self._contexts:
            self._last_active[tenant_id] = time.time()
            return self._contexts[tenant_id]

        # Wait for slot if at max concurrent
        await self._semaphore.acquire()

        try:
            profile_dir = PROFILE_BASE_DIR / tenant_id
            profile_dir.mkdir(parents=True, exist_ok=True)

            # Persistent context = customer's session persists between launches
            context = await self._playwright.chromium.launch_persistent_context(
                user_data_dir=str(profile_dir),
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-blink-features=AutomationControlled",
                ],
                storage_state=storage_state,
            )

            self._contexts[tenant_id] = context
            self._last_active[tenant_id] = time.time()
            log.info(f"Opened context for tenant {tenant_id}")
            return context

        except Exception:
            self._semaphore.release()
            raise

    async def close_context(self, tenant_id: str):
        """Close a customer's browser context (free memory + slot)."""
        context = self._contexts.pop(tenant_id, None)
        self._last_active.pop(tenant_id, None)

        if context:
            try:
                await context.close()
            except Exception as e:
                log.warning(
                    f"Error closing context {tenant_id}: {e}"
                )
            finally:
                self._semaphore.release()
                log.info(f"Closed context for tenant {tenant_id}")

    async def _cleanup_idle_loop(self):
        """Background: close contexts idle > timeout. Runs every 5 min."""
        while True:
            try:
                await asyncio.sleep(300)
                now = time.time()

                to_close = [
                    tid for tid, last_ts in self._last_active.items()
                    if (now - last_ts) > self.idle_timeout
                ]

                for tid in to_close:
                    log.info(f"Idle cleanup: tenant {tid}")
                    await self.close_context(tid)

            except asyncio.CancelledError:
                break
            except Exception as e:
                log.error(f"Cleanup loop error: {e}")

    async def shutdown(self):
        """Graceful shutdown: stop cleanup, close all contexts + browser."""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

        for tid in list(self._contexts.keys()):
            await self.close_context(tid)

        if self._playwright:
            await self._playwright.stop()

        self._started = False
        log.info("BrowserPool shutdown complete")

    def stats(self) -> dict:
        """Pool statistics for monitoring."""
        return {
            "active_contexts": len(self._contexts),
            "max_active": self.max_active,
            "started": self._started,
        }
