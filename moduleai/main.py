# moduleai/main.py — AI module (port 8002)
# v0.2: OpenAI gpt-5-nano via DB key (test mode, single model)

import os
import logging
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

try:
    from moduleai.persona import PERSONAS, get_persona, resolve_persona
    from moduleai.training import TrainingCollector
    from moduleai.db import get_api_key, log_token_usage, get_brain_prompt
except ImportError:
    from persona import PERSONAS, get_persona, resolve_persona
    from training import TrainingCollector
    from db import get_api_key, log_token_usage, get_brain_prompt

logging.basicConfig(level=logging.INFO, format="%(asctime)s [ai] %(message)s")
log = logging.getLogger("moduleai")

app = FastAPI(title="ViiV AI Module", version="0.2.0")
collector = TrainingCollector()

# Test mode: lock single model
LOCKED_MODEL = os.getenv("AI_MODEL", "gpt-4.1-nano")
LOCKED_PROVIDER = "openai"


class ChatIn(BaseModel):
    message: str
    persona: str | None = None         # legacy key (moduleai namespace)
    slot: str | None = "chat_bot"      # brain slot
    tenant_id: str | None = None
    source: str | None = "chat"        # chat | autopost | pos_help
    shop_id: str | None = None         # backward compat
    # Phase 1 persona injection fields (all optional — backward compat)
    store_name:  str | None = None     # ชื่อร้านจริง (แทน shop_id ดิบ)
    persona_key: str | None = None     # tenant PERSONA_IDS key
    tone:        str | None = None     # ai_context.constraints
    biz_type:    str | None = None     # "l1 > l2 > l3"


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

    # Phase 1: resolve persona via alias map (รองรับทั้ง 2 namespace)
    persona = resolve_persona(payload.persona_key or payload.persona)

    # Phase 1: สร้าง subs dict สำหรับ replace placeholder ใน brain_prompt
    subs = {
        "tenant_name": payload.store_name or "ร้านค้า",
    }
    brain_prompt = get_brain_prompt(payload.slot or "chat_bot", subs=subs)

    if brain_prompt:
        # ZONE 1 — identity block (persona + biz_type + tone) นำหน้า orchestration
        identity: list[str] = []
        if payload.store_name:
            identity.append(f"คุณคือผู้ช่วยร้าน {payload.store_name}")
        if payload.biz_type:
            identity.append(f"ร้านขาย: {payload.biz_type}")
        persona_tone = persona.get("system_prompt", "")
        if persona_tone:
            identity.append(persona_tone)
        if payload.tone:
            identity.append(f"ข้อกำหนดการตอบ: {payload.tone}")

        identity_block = "\n".join(identity)
        system_prompt = (identity_block + "\n\n" + brain_prompt
                         if identity_block else brain_prompt)
        log.info("[brain] slot=%s identity=%d prompt=%d chars",
                 payload.slot, len(identity_block), len(system_prompt))
    else:
        system_prompt = persona["system_prompt"]
        log.info("[brain] slot=%s → fallback persona=%s", payload.slot, persona["name"])

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
            max_tokens=500,
            temperature=1,
        )
        reply = r["choices"][0]["message"]["content"]

        # token usage from response
        usage = r.get("usage", {}) or {}
        in_tok  = usage.get("prompt_tokens", 0)
        out_tok = usage.get("completion_tokens", 0)

        log.info(
            "[%s] in=%d out=%d → %s",
            persona["name"], in_tok, out_tok, reply[:60]
        )

    except Exception as e:
        log.exception("LiteLLM error: %s", e)
        raise HTTPException(502, f"AI provider error: {e}")

    collector.collect(payload.message, reply, payload.tenant_id)
    cost = log_token_usage(
        tenant_id=payload.tenant_id,
        provider=LOCKED_PROVIDER,
        model=LOCKED_MODEL,
        input_tokens=in_tok,
        output_tokens=out_tok,
        source=payload.source or "chat",
    ) or 0
    return {
        "reply": reply,
        "persona": persona["name"],
        "model": LOCKED_MODEL,
        "provider": LOCKED_PROVIDER,
        "tokens_in": in_tok,
        "tokens_out": out_tok,
        "cost_usd": cost,
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
