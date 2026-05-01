# modulechat/main.py — Chat module (port 8003)
# Phase 1: scaffold — webhook receiver + health + conversation list stub.

import os
import json
import logging
from fastapi import FastAPI, Request

logging.basicConfig(level=logging.INFO, format="%(asctime)s [chat] %(message)s")
log = logging.getLogger("modulechat")

app = FastAPI(title="ViiV Chat Module", version="0.1.0")

try:
    from modulechat.bot import ChatBot
    from modulechat.inbox import Inbox
except ImportError:
    # cwd-style run: `cd modulechat && uvicorn main:app`
    from bot import ChatBot
    from inbox import Inbox

bot = ChatBot()
inbox = Inbox()


@app.get("/health")
def health():
    return {"status": "ok", "module": "chat"}


@app.get("/conversations")
def list_conversations():
    """List active conversations (stub — empty until DB layer added)."""
    return {"conversations": [], "total": 0}


@app.post("/webhook/line")
async def webhook_line(request: Request):
    """Receive LINE webhook events. Each event is logged + forwarded to bot."""
    try:
        body = await request.body()
        data = json.loads(body) if body else {}
    except Exception as e:
        log.warning("invalid JSON body: %s", e)
        data = {}

    events = data.get("events", []) or []
    log.info("webhook received: %d event(s)", len(events))

    for ev in events:
        log.info("event: type=%s source=%s",
                 ev.get("type"),
                 (ev.get("source") or {}).get("userId", "?"))
        try:
            bot.receive(ev)
        except Exception as e:
            log.exception("bot.receive failed: %s", e)

    return {"status": "ok", "received": len(events)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "modulechat.main:app",
        host="0.0.0.0",
        port=int(os.getenv("CHAT_PORT", "8003")),
        reload=False,
    )
