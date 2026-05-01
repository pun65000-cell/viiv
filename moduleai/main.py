# moduleai/main.py — AI module (port 8002)
# Phase 1: minimal /chat endpoint backed by LiteLLM (Anthropic) +
# persona system prompt + training collector stub.

import os
import logging
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from moduleai.persona import PERSONAS, get_persona
from moduleai.training import TrainingCollector

logging.basicConfig(level=logging.INFO, format="%(asctime)s [ai] %(message)s")
log = logging.getLogger("moduleai")

app = FastAPI(title="ViiV AI Module", version="0.1.0")
collector = TrainingCollector()

DEFAULT_MODEL = os.getenv("AI_MODEL", "claude-haiku-4-5")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")


class ChatIn(BaseModel):
    message: str
    persona: str | None = None     # key in PERSONAS; default female_1
    tenant_id: str | None = None


@app.get("/health")
def health():
    return {"status": "ok", "module": "ai"}


@app.post("/chat")
def chat(payload: ChatIn):
    if not payload.message:
        raise HTTPException(400, "empty message")

    persona = get_persona(payload.persona)
    system_prompt = persona["system_prompt"]

    if not ANTHROPIC_API_KEY:
        # No key configured — return canned reply so the pipeline still works
        # in dev/test without spending tokens.
        reply = f"(stub:{persona['name']}) ขอบคุณค่ะ — ระบบยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY"
        log.info("[stub] %s → %s", payload.message[:60], reply[:60])
        collector.collect(payload.message, reply, payload.tenant_id)
        return {"reply": reply, "persona": persona["name"], "model": "stub"}

    try:
        from litellm import completion
        r = completion(
            model=f"anthropic/{DEFAULT_MODEL}",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": payload.message},
            ],
            max_tokens=400,
            temperature=0.7,
        )
        reply = r["choices"][0]["message"]["content"]
    except Exception as e:
        log.exception("LiteLLM error: %s", e)
        raise HTTPException(502, f"AI provider error: {e}")

    collector.collect(payload.message, reply, payload.tenant_id)
    return {"reply": reply, "persona": persona["name"], "model": DEFAULT_MODEL}


@app.get("/personas")
def list_personas():
    return {"personas": [
        {"key": k, "name": v["name"], "gender": v["gender"], "age": v["age"], "tone": v["tone"]}
        for k, v in PERSONAS.items()
    ]}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "moduleai.main:app",
        host="0.0.0.0",
        port=int(os.getenv("AI_PORT", "8002")),
        reload=False,
    )
