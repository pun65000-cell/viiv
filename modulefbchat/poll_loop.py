"""
Background poll loop — รัน poll_room_and_reply ทุก 30 วินาที
ต่อ room ที่ active
"""

import asyncio
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

POLL_INTERVAL = 30  # วินาที (Rule 327)

# registry: room_id → tenant_id (in-memory)
_active_rooms: dict[str, str] = {}
_loop_task: Optional[asyncio.Task] = None

BOT_USER = os.getenv("MATRIX_BOT_USER", "@viivadmin:viiv.local")


def register_room(room_id: str, tenant_id: str) -> None:
    """เพิ่ม room เข้า polling list"""
    _active_rooms[room_id] = tenant_id
    logger.info("Registered room=%s tenant=%s", room_id, tenant_id)


def unregister_room(room_id: str) -> None:
    """ลบ room ออกจาก polling list"""
    _active_rooms.pop(room_id, None)
    logger.info("Unregistered room=%s", room_id)


def list_rooms() -> dict[str, str]:
    return dict(_active_rooms)


async def start_poll_loop() -> None:
    """เริ่ม background loop — เรียกใน FastAPI lifespan startup (Rule 353)"""
    global _loop_task
    _loop_task = asyncio.create_task(_run_loop(), name="matrix-poll-loop")
    logger.info("Matrix poll loop started (interval=%ds)", POLL_INTERVAL)


async def stop_poll_loop() -> None:
    """หยุด loop — เรียกตอน lifespan shutdown"""
    global _loop_task
    if _loop_task and not _loop_task.done():
        _loop_task.cancel()
        try:
            await _loop_task
        except asyncio.CancelledError:
            pass
    _loop_task = None
    logger.info("Matrix poll loop stopped")


async def _run_loop() -> None:
    from .matrix_poller import poll_room_and_reply
    while True:
        for room_id, tenant_id in list(_active_rooms.items()):
            try:
                await poll_room_and_reply(
                    room_id=room_id,
                    tenant_id=tenant_id,
                    bot_user_id=BOT_USER,
                )
            except Exception as exc:
                logger.error("Poll error room=%s: %s", room_id, exc)
        await asyncio.sleep(POLL_INTERVAL)
