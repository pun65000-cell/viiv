"""Phase 3.D.3 — WebSocket endpoint for CDP screencast.

DEV ONLY (X-Dev-Mode: 1 header or VIIV_DEV_MODE=1 env).
Frontend canvas = Phase 3.D.4.

WS protocol:
  Server → Client:
    binary: JPEG frame bytes
    JSON:   {type: "ready"|"error"|"info"|"pong", ...}

  Client → Server (JSON text):
    {type: "mouse",    action, x, y, button?, modifiers?, clickCount?}
    {type: "key",      action, text?|key?|code?}
    {type: "navigate", url}  — facebook.com/* or about:blank only
    {type: "ping"}
"""
from __future__ import annotations

import json
import logging
import os
from typing import Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from ..auth import decode_tenant_token
from ..browser.cdp_bridge import CDPBridge

logger = logging.getLogger(__name__)
router = APIRouter(tags=["fb-screencast"])

_ALLOWED_URL_PREFIXES = (
    "about:blank",
    "https://www.facebook.com/",
    "https://facebook.com/",
    "https://m.facebook.com/",
)


def _dev_enabled(dev_param: Optional[str]) -> bool:
    return os.getenv("VIIV_DEV_MODE") == "1" or dev_param == "1"


@router.websocket("/screencast/{tenant_id}")
async def screencast(
    ws: WebSocket,
    tenant_id: str,
    token: str = Query(...),
    dev: Optional[str] = Query(None),
):
    # Dev guard — close before accept to avoid handshake
    if not _dev_enabled(dev):
        await ws.close(code=1008, reason="dev only")
        return

    # Auth: token is raw JWT (no "Bearer " prefix)
    try:
        claims = decode_tenant_token(token)
        if claims.get("tenant_id") != tenant_id:
            await ws.close(code=1008, reason="tenant mismatch")
            return
    except Exception as e:
        logger.warning("ws auth failed: %s", e)
        await ws.close(code=1008, reason="auth failed")
        return

    await ws.accept()

    pool = ws.app.state.pool
    if pool is None or not pool._started:
        await ws.send_json({"type": "error", "message": "browser pool not started"})
        await ws.close()
        return

    bridge: Optional[CDPBridge] = None
    page = None

    try:
        context = await pool.get_context(tenant_id)
        page = await context.new_page()
        await page.set_viewport_size({"width": 1280, "height": 800})

        bridge = CDPBridge(context, page)
        await bridge.start()
        await page.goto("about:blank", timeout=10_000)

        async def on_frame(data: bytes, session_id: int, _frame_num: int) -> None:
            try:
                await ws.send_bytes(data)
            except Exception:
                pass

        await bridge.start_screencast(on_frame=on_frame)
        await ws.send_json({"type": "ready"})

        while True:
            msg_text = await ws.receive_text()
            try:
                msg = json.loads(msg_text)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "message": "invalid json"})
                continue

            mtype = msg.get("type")

            if mtype == "mouse":
                await bridge.dispatch_mouse(msg)

            elif mtype == "key":
                await bridge.dispatch_key(msg)

            elif mtype == "navigate":
                url = msg.get("url", "about:blank")
                if not any(url == p or url.startswith(p) for p in _ALLOWED_URL_PREFIXES):
                    await ws.send_json({"type": "error", "message": "url not allowed"})
                    continue
                await page.goto(url, timeout=15_000)
                await ws.send_json({"type": "info", "navigated": url})

            elif mtype == "ping":
                await ws.send_json({"type": "pong"})

            else:
                await ws.send_json({"type": "error", "message": f"unknown type: {mtype}"})

    except WebSocketDisconnect:
        logger.info("ws disconnected: tenant=%s", tenant_id)

    except Exception as e:
        logger.exception("ws error: tenant=%s err=%s", tenant_id, e)
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass

    finally:
        if bridge:
            try:
                await bridge.stop_screencast()
                await bridge.close()
            except Exception as e:
                logger.warning("bridge cleanup error: %s", e)
        if page:
            try:
                await page.close()
            except Exception as e:
                logger.warning("page close error: %s", e)
        try:
            await ws.close()
        except Exception:
            pass
