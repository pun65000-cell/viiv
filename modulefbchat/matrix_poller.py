"""
Matrix room poller — poll Synapse ดู new messages แล้วส่ง AI reply
Pattern: เหมือน _ai_push_reply ใน pos_line.py
"""

import asyncio
import httpx
import logging
import os
import time
import random
from typing import Optional

logger = logging.getLogger(__name__)

MATRIX_HS = os.getenv("MATRIX_HOMESERVER", "http://localhost:8008")
MATRIX_TOKEN = os.getenv("MATRIX_ACCESS_TOKEN", "")
MODULEAI_URL = "http://localhost:8002/chat"

# track since_token ต่อ room (in-memory)
_room_since: dict[str, str] = {}
# track event_ids ที่ reply ไปแล้ว (idempotency — Rule 166)
_replied_events: set[str] = set()


async def poll_room_and_reply(
    room_id: str,
    tenant_id: str,
    bot_user_id: str,
) -> None:
    """
    Poll Matrix room หา new inbound messages
    ถ้าเจอ → เรียก moduleai → reply กลับ room → ส่งถึง Messenger

    รัน ทุก 30 วินาที (Rule 327)
    """
    since = _room_since.get(room_id, "")

    params: dict = {"limit": 20, "dir": "f"}
    if since:
        params["from"] = since

    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(
            f"{MATRIX_HS}/_matrix/client/v3/rooms/{room_id}/messages",
            headers={"Authorization": f"Bearer {MATRIX_TOKEN}"},
            params=params,
        )
        if r.status_code != 200:
            logger.warning("poll_room %s failed: %d", room_id, r.status_code)
            return

        data = r.json()
        events = data.get("chunk", [])
        end_token = data.get("end", since)
        _room_since[room_id] = end_token

        for event in events:
            if event.get("type") != "m.room.message":
                continue
            sender = event.get("sender", "")
            if sender == bot_user_id:
                continue
            event_id = event.get("event_id", "")
            if not event_id or event_id in _replied_events:
                continue

            content = event.get("content", {})
            msg_text = content.get("body", "")
            if not msg_text:
                continue

            # human-like delay ก่อน reply (Rule 341, 343)
            delay = random.uniform(30, 120)
            logger.info(
                "New message room=%s text='%s...' → reply in %.0fs",
                room_id, msg_text[:50], delay,
            )
            await asyncio.sleep(delay)

            # เรียก moduleai (pattern เดียวกับ pos_line.py)
            reply_text = await _call_moduleai(msg_text, tenant_id)
            if not reply_text:
                continue

            # ส่ง reply กลับ Matrix room → bridge ส่งต่อไป Messenger
            ok = await _send_matrix_message(client, room_id, reply_text)
            if ok:
                _replied_events.add(event_id)
                # ป้องกัน set โต (Rule 166)
                if len(_replied_events) > 10000:
                    _replied_events.clear()


async def _call_moduleai(message: str, tenant_id: str) -> Optional[str]:
    """เรียก moduleai /chat — sync httpx ใน executor (Rule 168)"""
    try:
        loop = asyncio.get_event_loop()

        def _sync_call() -> str:
            with httpx.Client(timeout=25.0) as hc:
                r = hc.post(
                    MODULEAI_URL,
                    json={
                        "message":   message,
                        "slot":      "chat_bot",
                        "tenant_id": tenant_id,
                        "source":    "fb_chat",
                        "shop_id":   tenant_id,
                    },
                )
                if r.status_code == 200:
                    return r.json().get("reply", "")
                logger.warning("moduleai returned %d tenant=%s", r.status_code, tenant_id)
                return ""

        reply = await loop.run_in_executor(None, _sync_call)
        return reply or None
    except Exception as exc:
        logger.error("_call_moduleai failed tenant=%s: %s", tenant_id, exc)
        return None


async def _send_matrix_message(
    client: httpx.AsyncClient,
    room_id: str,
    text: str,
) -> bool:
    """ส่ง m.text เข้า Matrix room → bridge ส่งต่อไป Messenger"""
    txn_id = f"viiv_{int(time.time() * 1000)}"
    try:
        r = await client.put(
            f"{MATRIX_HS}/_matrix/client/v3/rooms/{room_id}/send/m.room.message/{txn_id}",
            headers={"Authorization": f"Bearer {MATRIX_TOKEN}"},
            json={"msgtype": "m.text", "body": text},
        )
        if r.status_code == 200:
            logger.info("Sent reply to room=%s", room_id)
            return True
        logger.warning("send_matrix_message %s → %d", room_id, r.status_code)
        return False
    except Exception as exc:
        logger.error("_send_matrix_message failed room=%s: %s", room_id, exc)
        return False
