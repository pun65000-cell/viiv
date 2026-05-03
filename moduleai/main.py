# moduleai/main.py — AI module (port 8002)
# v0.2: OpenAI gpt-5-nano via DB key (test mode, single model)

import os
import logging
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

try:
    from moduleai.persona import PERSONAS, get_persona
    from moduleai.training import TrainingCollector
    from moduleai.db import get_api_key, log_token_usage
except ImportError:
    from persona import PERSONAS, get_persona
    from training import TrainingCollector
    from db import get_api_key, log_token_usage

logging.basicConfig(level=logging.INFO, format="%(asctime)s [ai] %(message)s")
log = logging.getLogger("moduleai")

app = FastAPI(title="ViiV AI Module", version="0.2.0")
collector = TrainingCollector()

# Test mode: lock single model
LOCKED_MODEL = os.getenv("AI_MODEL", "gpt-5-nano")
LOCKED_PROVIDER = "openai"


class ChatIn(BaseModel):
    message: str
    persona: str | None = None
    tenant_id: str | None = None
    source: str | None = "chat"   # chat | autopost | pos_help


@app.get("/health")
def health():
    has_key = bool(get_api_key(LOCKED_PROVIDER))
    return {
        "status": "ok",
        "module": "ai",
        "model": LOCKED_MODEL,
        "provider": LOCKED_PROVIDER,
        "key_loaded": has_key,
    }


@app.post("/chat")
def chat(payload: ChatIn):
    if not payload.message:
        raise HTTPException(400, "empty message")

    persona = get_persona(payload.persona)
    system_prompt = persona["system_prompt"]

    api_key = get_api_key(LOCKED_PROVIDER)
    if not api_key:
        reply = f"(stub:{persona['name']}) OpenAI key ยังไม่ได้ตั้งค่าใน DB ค่ะ"
        log.warning("no openai key in DB → stub reply")
        collector.collect(payload.message, reply, payload.tenant_id)
        return {"reply": reply, "persona": persona["name"], "model": "stub"}

    # set env for litellm (per-request)
    os.environ["OPENAI_API_KEY"] = api_key

    try:
        import litellm
        from litellm import completion
        # gpt-5 family rejects temperature ≠ 1, max_tokens, etc. — let
        # litellm drop unsupported params instead of erroring out.
        litellm.drop_params = True
        r = completion(
            model=f"openai/{LOCKED_MODEL}",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": payload.message},
            ],
            max_tokens=2000,
            temperature=0.7,
        )
        reply = r["choices"][0]["message"]["content"]

        # token usage from response
        usage = r.get("usage", {}) or {}
        in_tok  = usage.get("prompt_tokens", 0)
        out_tok = usage.get("completion_tokens", 0)

        log_token_usage(
            tenant_id=payload.tenant_id,
            provider=LOCKED_PROVIDER,
            model=LOCKED_MODEL,
            input_tokens=in_tok,
            output_tokens=out_tok,
            source=payload.source or "chat",
        )

        log.info(
            "[%s] in=%d out=%d → %s",
            persona["name"], in_tok, out_tok, reply[:60]
        )

    except Exception as e:
        log.exception("LiteLLM error: %s", e)
        raise HTTPException(502, f"AI provider error: {e}")

    collector.collect(payload.message, reply, payload.tenant_id)
    return {
        "reply": reply,
        "persona": persona["name"],
        "model": LOCKED_MODEL,
        "provider": LOCKED_PROVIDER,
    }


@app.get("/personas")
def list_personas():
    return {"personas": [
        {
            "key": k,
            "name": v["name"],
            "gender": v["gender"],
            "age": v["age"],
            "tone": v["tone"],
        }
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
