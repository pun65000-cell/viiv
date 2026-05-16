# moduleai/main.py — AI module (port 8002)
# v0.3: 4-zone prompt assembly + keyword-scan (Phase 2)

import os
import re
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

app = FastAPI(title="ViiV AI Module", version="0.3.0")
collector = TrainingCollector()

# Test mode: lock single model
LOCKED_MODEL = os.getenv("AI_MODEL", "gpt-4.1-nano")
LOCKED_PROVIDER = "openai"

# Phase 2: platform-level blocked keywords (always enforced, regardless of tenant settings)
BLOCK_WORDS_BASE = [
    "ยาเสพติด", "อาวุธ", "ปืน", "ระเบิด",
    "ผิดกฎหมาย", "ลิขสิทธิ์", "ของเลียนแบบ", "ปลอม",
]


def _safety_tokens(safety_text: str) -> list[str]:
    """แยก safety_text (คั่นด้วย comma/newline/space) เป็น list คำ ความยาว >= 2"""
    tokens = re.split(r"[,\n\s]+", safety_text or "")
    return [t.strip() for t in tokens if len(t.strip()) >= 2]


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
    # Phase 2 boundary fields (all optional — backward compat)
    do_text:     str | None = None     # สิ่งที่ร้านอยากให้ช่วย
    dont_text:   str | None = None     # สิ่งที่ห้ามพูดถึง
    safety_text: str | None = None     # คำที่ trigger block ก่อน LLM


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

    # Phase 2: keyword-scan — short-circuit BEFORE LLM call
    msg_l = (payload.message or "").lower()
    scan_words = BLOCK_WORDS_BASE + _safety_tokens(payload.safety_text or "")
    hit = next((w for w in scan_words if w and w.lower() in msg_l), None)
    if hit:
        log.info("[block] keyword=%s tenant=%s", hit, payload.tenant_id)
        reply = "ขออภัยครับ เรื่องนี้ทางพนักงานจะติดต่อกลับ เพื่อให้ข้อมูลที่ถูกต้องนะครับ"
        collector.collect(payload.message, reply, payload.tenant_id)
        return {
            "reply": reply,
            "persona": "system",
            "model": "blocked",
            "provider": "none",
            "tokens_in": 0,
            "tokens_out": 0,
            "cost_usd": 0,
            "blocked": True,
        }

    # Phase 1: resolve persona via alias map (รองรับทั้ง 2 namespace)
    persona = resolve_persona(payload.persona_key or payload.persona)

    # Phase 1: สร้าง subs dict สำหรับ replace placeholder ใน brain_prompt
    subs = {
        "tenant_name": payload.store_name or "ร้านค้า",
    }
    brain_prompt, prohibit_text = get_brain_prompt(
        payload.slot or "chat_bot", subs=subs
    )

    if brain_prompt:
        # ZONE 1 — identity (persona + biz_type + tone + do_text)
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
        if payload.do_text:
            identity.append(f"สิ่งที่ร้านอยากให้ช่วย: {payload.do_text}")

        identity_block = "\n".join(identity)

        # ZONE 2 — boundaries (dont_text + safety_text)
        boundary_lines: list[str] = []
        if payload.dont_text:
            boundary_lines.append(f"ห้ามพูดถึง: {payload.dont_text}")
        if payload.safety_text:
            boundary_lines.append(f"ห้ามตอบเรื่อง: {payload.safety_text}")
        boundary_block = "\n".join(boundary_lines)

        # ZONE 3 — orchestration (brain_prompt)
        # ZONE 4 — absolute prohibition (prohibit_text from platform DB)
        prohibit_block = (f"\n[ห้ามเด็ดขาด] {prohibit_text}" if prohibit_text else "")

        parts = []
        if identity_block:
            parts.append(identity_block)
        if boundary_block:
            parts.append(boundary_block)
        parts.append(brain_prompt)
        if prohibit_block:
            parts.append(prohibit_block)

        system_prompt = "\n\n".join(parts)
        log.info("[brain] slot=%s identity=%d boundary=%d prompt=%d prohibit=%d chars",
                 payload.slot, len(identity_block), len(boundary_block),
                 len(brain_prompt), len(prohibit_text))
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
