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
    except Exception as e:
        print(f"[moduleai.db] log_token_usage error: {e}")
