# modulechat/bot.py — Phase 1 stub
# Forwards incoming LINE events to moduleai for reply generation,
# then stores the conversation. DB layer is a print stub for now.

import os
import logging
import httpx

log = logging.getLogger("modulechat.bot")

AI_URL = os.getenv("AI_URL", "http://localhost:8002")
AI_TIMEOUT = float(os.getenv("AI_TIMEOUT", "10"))


class ChatBot:
    """Receive an event → forward to moduleai → store conversation."""

    def receive(self, event: dict) -> dict:
        msg = event.get("message") or {}
        text_in = (msg.get("text") or "").strip()
        if not text_in:
            return {"skipped": "no text"}

        try:
            with httpx.Client(timeout=AI_TIMEOUT) as c:
                r = c.post(f"{AI_URL}/chat", json={"message": text_in})
                reply = r.json().get("reply", "") if r.status_code == 200 else ""
        except Exception as e:
            log.warning("AI call failed: %s", e)
            reply = ""

        self.store({
            "user_id": (event.get("source") or {}).get("userId", ""),
            "question": text_in,
            "answer":   reply,
        })
        return {"reply": reply}

    def store(self, conversation: dict) -> None:
        """Persist conversation. Phase 1: print stub.
        TODO Phase 2: INSERT INTO chat_conversations."""
        print("STORE:", conversation)
