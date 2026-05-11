"""Activity score calculation per Phase B section 2.4.

Score formula:
    score = recency_weight + frequency_weight + tier_weight

recency_weight (based on last_inbound_at):
    < 5 min      = +100
    5-30 min     = +50
    30-120 min   = +10
    > 120 min    = 0

frequency_weight:
    message_count_24h / 10 (cap at +50)

tier_weight (based on tenants.package_id):
    pkg_privacy  = +30
    pkg_pro      = +20
    pkg_standard = +10
    pkg_basic    = 0
    pkg_free     = -10
    other        = 0
"""
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("modulepool.scorer")

TIER_WEIGHTS = {
    "pkg_privacy": 30,
    "pkg_pro": 20,
    "pkg_standard": 10,
    "pkg_basic": 0,
    "pkg_free": -10,
}


def compute_recency_weight(last_inbound_at: Optional[datetime]) -> int:
    if last_inbound_at is None:
        return 0
    now = datetime.now(timezone.utc)
    if last_inbound_at.tzinfo is None:
        last_inbound_at = last_inbound_at.replace(tzinfo=timezone.utc)
    minutes = (now - last_inbound_at).total_seconds() / 60.0
    if minutes < 5:
        return 100
    if minutes < 30:
        return 50
    if minutes < 120:
        return 10
    return 0


def compute_frequency_weight(message_count_24h: int) -> int:
    return min(message_count_24h // 10, 50)


def compute_tier_weight(package_id: Optional[str]) -> int:
    if not package_id:
        return 0
    return TIER_WEIGHTS.get(package_id, 0)


def compute_score(
    last_inbound_at: Optional[datetime],
    message_count_24h: int,
    package_id: Optional[str],
) -> int:
    return (
        compute_recency_weight(last_inbound_at)
        + compute_frequency_weight(message_count_24h)
        + compute_tier_weight(package_id)
    )


async def update_tenant_score(pool, tenant_id: str, platform: str) -> int:
    """Read activity + tier from DB → compute score → upsert into tenant_activity."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT
                   COALESCE(a.last_inbound_at, NULL) AS last_inbound_at,
                   COALESCE(a.message_count_24h, 0) AS message_count_24h,
                   t.package_id
               FROM tenants t
               LEFT JOIN tenant_activity a
                   ON a.tenant_id = t.id AND a.platform = $2
               WHERE t.id = $1""",
            tenant_id, platform,
        )
        if not row:
            logger.warning("tenant %s not found in tenants table", tenant_id)
            return 0

        score = compute_score(
            row["last_inbound_at"],
            row["message_count_24h"],
            row["package_id"],
        )

        await conn.execute(
            """INSERT INTO tenant_activity
                   (tenant_id, platform, current_score, score_updated_at, updated_at)
               VALUES ($1, $2, $3, now(), now())
               ON CONFLICT (tenant_id, platform) DO UPDATE
               SET current_score = EXCLUDED.current_score,
                   score_updated_at = now(),
                   updated_at = now()""",
            tenant_id, platform, score,
        )
        return score
