# moduleai/db.py — DB helper for API keys + token logging
import os
import psycopg2
from psycopg2.extras import RealDictCursor

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:viiv_secure_123@10.1.0.3:5434/postgres"
)

# ราคา per 1M tokens (USD)
MODEL_PRICING = {
    "gpt-5-nano":    {"in": 0.05, "out": 0.40},
    "gpt-5.4-nano":  {"in": 0.20, "out": 1.25},
    "gpt-4o-mini":   {"in": 0.15, "out": 0.60},
    "deepseek-chat": {"in": 0.14, "out": 0.28},
}


def get_api_key(provider: str) -> str | None:
    """อ่าน api_key จาก ai_api_keys ที่ is_active=true"""
    try:
        with psycopg2.connect(DB_URL) as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT api_key FROM ai_api_keys "
                    "WHERE provider=%s AND is_active=true LIMIT 1",
                    (provider,),
                )
                row = cur.fetchone()
                return row["api_key"] if row else None
    except Exception as e:
        print(f"[moduleai.db] get_api_key({provider}) error: {e}")
        return None


def log_token_usage(
    tenant_id: str | None,
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    source: str = "chat",
):
    """Insert ai_token_log + คำนวณ cost"""
    pricing = MODEL_PRICING.get(model, {"in": 0.15, "out": 0.60})
    cost = (
        input_tokens * pricing["in"] + output_tokens * pricing["out"]
    ) / 1_000_000

    try:
        with psycopg2.connect(DB_URL) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO ai_token_log
                      (tenant_id, provider, model,
                       input_tokens, output_tokens, total_tokens,
                       cost_usd, source, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, now())
                    """,
                    (
                        tenant_id, provider, model,
                        input_tokens, output_tokens,
                        input_tokens + output_tokens,
                        cost, source,
                    ),
                )
                conn.commit()
        return cost
    except Exception as e:
        print(f"[moduleai.db] log_token_usage error: {e}")
        return 0.0


def get_brain_prompt(
    slot: str,
    brain_group: str = "customer",
    subs: dict | None = None,
) -> str | None:
    """
    อ่าน base_text + custom_text + active patches จาก ai_prompts
    compose เป็น final prompt แล้ว return
    ถ้าไม่มีข้อมูล → return None (caller ใช้ persona fallback)

    subs: dict ที่ใช้ replace placeholder เช่น {"tenant_name": "ร้านผัก"}
          None → behavior เดิม (backward compat)
    """
    try:
        with psycopg2.connect(DB_URL) as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT base_text, custom_text FROM ai_prompts WHERE slot=%s",
                    (slot,)
                )
                row = cur.fetchone()
                if not row:
                    return None

                base = (row["base_text"] or "").strip()
                custom = (row["custom_text"] or "").strip()

                if base.startswith("[TODO"):
                    return None

                cur.execute(
                    """
                    SELECT patch_text FROM ai_prompt_patches
                    WHERE slot=%s AND is_active=true
                    ORDER BY priority ASC, created_at ASC
                    """,
                    (slot,)
                )
                patches = [r["patch_text"] for r in cur.fetchall()]

                parts = [base]
                if custom:
                    parts.append("\n=== บริบทเพิ่มเติม ===\n" + custom)
                if patches:
                    parts.append("\n=== ข้อกำหนด ===")
                    for p in patches:
                        parts.append("- " + p)

                parts.append("\n[ระบบ] ตอบสั้นกระชับ ไม่เกิน 2 ประโยค ห้ามอธิบายยาว")
                result = "\n".join(parts)

                if subs:
                    for k, v in subs.items():
                        result = result.replace("{" + k + "}", str(v) if v is not None else "")

                return result

    except Exception as e:
        print(f"[moduleai.db] get_brain_prompt({slot}) error: {e}")
        return None
