"""Phase 3.D.3 — CDP screencast bridge.

Encapsulates Chrome DevTools Protocol commands for:
  - Screencast frame streaming (Page.startScreencast → JPEG frames)
  - Input event dispatch (mouse, keyboard)

Usage:
  bridge = CDPBridge(context, page)
  await bridge.start()
  await bridge.start_screencast(on_frame=...)
  await bridge.dispatch_mouse({"action": "click", "x": 100, "y": 200})
  await bridge.stop_screencast()
  await bridge.close()
"""
from __future__ import annotations

import base64
import logging
from typing import Awaitable, Callable, Optional

logger = logging.getLogger(__name__)


class CDPBridge:
    """CDP wrapper for screencast + input dispatch."""

    def __init__(self, context, page):
        self._context = context
        self._page = page
        self._cdp = None
        self._on_frame: Optional[Callable[[bytes, int, int], Awaitable[None]]] = None

    async def start(self) -> None:
        """Initialize CDP session for the page."""
        logger.info("[cdp] start: getting CDP session from context")
        self._cdp = await self._context.new_cdp_session(self._page)
        logger.info("[cdp] CDP session ready")
        self._frame_count = 0

    async def start_screencast(
        self,
        on_frame: Callable[[bytes, int, int], Awaitable[None]],
        *,
        format: str = "jpeg",
        quality: int = 70,
        max_width: int = 1280,
        max_height: int = 800,
        every_nth_frame: int = 1,
    ) -> None:
        """Start receiving screencast frames.

        on_frame(data: bytes, session_id: int, frame_num: int) is called
        per frame. CDPBridge handles Page.screencastFrameAck automatically.
        """
        if self._cdp is None:
            raise RuntimeError("call start() first")

        self._on_frame = on_frame
        self._cdp.on("Page.screencastFrame", self._handle_frame)

        logger.info("[cdp] enabling Page domain")
        await self._cdp.send("Page.enable")
        logger.info("[cdp] starting screencast")
        await self._cdp.send("Page.startScreencast", {
            "format": format,
            "quality": quality,
            "maxWidth": max_width,
            "maxHeight": max_height,
            "everyNthFrame": every_nth_frame,
        })
        logger.info("[cdp] screencast cmd sent")

    async def _handle_frame(self, params: dict) -> None:
        """Receive frame from CDP, decode, forward to caller, ack."""
        try:
            data = base64.b64decode(params["data"])
            session_id = params["sessionId"]

            self._frame_count += 1
            if self._frame_count <= 3 or self._frame_count % 50 == 0:
                logger.info("[cdp] frame #%d size=%d", self._frame_count, len(data))

            if self._on_frame:
                await self._on_frame(data, session_id, 0)

            await self._cdp.send("Page.screencastFrameAck", {"sessionId": session_id})
        except Exception as e:
            logger.exception("frame handler error: %s", e)

    async def stop_screencast(self) -> None:
        if self._cdp:
            try:
                await self._cdp.send("Page.stopScreencast")
            except Exception as e:
                logger.warning("stopScreencast failed: %s", e)

    async def dispatch_mouse(self, msg: dict) -> None:
        """msg = {action, x, y, button?, clickCount?, modifiers?}
        action='click' → mousePressed + mouseReleased sequence.
        """
        if self._cdp is None:
            return

        action = msg.get("action", "")
        x_raw = msg.get("x")
        y_raw = msg.get("y")
        if x_raw is None or y_raw is None:
            logger.warning("dispatch_mouse: invalid coords x=%s y=%s action=%s", x_raw, y_raw, action)
            return
        try:
            x = float(x_raw)
            y = float(y_raw)
        except (TypeError, ValueError) as e:
            logger.warning("dispatch_mouse: float convert failed x=%s y=%s err=%s", x_raw, y_raw, e)
            return
        import math
        if not (math.isfinite(x) and math.isfinite(y)):
            logger.warning("dispatch_mouse: non-finite coords x=%s y=%s", x, y)
            return
        button = msg.get("button", "left")
        modifiers = msg.get("modifiers", 0)
        click_count = msg.get("clickCount", 1)

        if action == "click":
            await self._cdp.send("Input.dispatchMouseEvent", {
                "type": "mousePressed", "x": x, "y": y,
                "button": button, "clickCount": click_count,
                "modifiers": modifiers,
            })
            await self._cdp.send("Input.dispatchMouseEvent", {
                "type": "mouseReleased", "x": x, "y": y,
                "button": button, "clickCount": click_count,
                "modifiers": modifiers,
            })
        else:
            await self._cdp.send("Input.dispatchMouseEvent", {
                "type": action, "x": x, "y": y,
                "button": button, "modifiers": modifiers,
            })

    async def dispatch_key(self, msg: dict) -> None:
        """msg = {action, text?|key?}
        action='type' → sequence of char events for each character.
        """
        if self._cdp is None:
            return

        action = msg.get("action", "")

        if action == "type":
            for ch in msg.get("text", ""):
                await self._cdp.send("Input.dispatchKeyEvent", {
                    "type": "char",
                    "text": ch,
                })
        else:
            payload: dict = {"type": action}
            for k in ("text", "key", "code", "modifiers", "windowsVirtualKeyCode"):
                if k in msg:
                    payload[k] = msg[k]
            await self._cdp.send("Input.dispatchKeyEvent", payload)

    async def close(self) -> None:
        if self._cdp:
            try:
                await self._cdp.detach()
            except Exception:
                pass
            self._cdp = None
