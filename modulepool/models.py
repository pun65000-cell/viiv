"""Pool state dataclasses (read-only DB representation for Phase C.2)."""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class PoolConfig:
    platform: str
    baseline_size: int
    max_size: int
    min_size: int
    eviction_idle_min: int
    cooling_grace_min: int
    enabled: bool


@dataclass
class PoolSlot:
    id: int
    platform: str
    slot_index: int
    state: str  # 'empty'|'warming'|'active'|'cooling'|'evicting'|'dead'
    current_tenant_id: Optional[str]
    assigned_at: Optional[datetime]
    last_activity_at: Optional[datetime]
    worker_pid: Optional[int]
    worker_host: str


@dataclass
class TenantActivity:
    tenant_id: str
    platform: str
    last_inbound_at: Optional[datetime]
    last_outbound_at: Optional[datetime]
    message_count_1h: int
    message_count_24h: int
    current_score: int
    score_updated_at: datetime


_CONFIG_FIELDS = {f for f in PoolConfig.__dataclass_fields__}


async def get_pool_config(pool, platform: str) -> Optional[PoolConfig]:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM pool_config WHERE platform = $1", platform
        )
        if not row:
            return None
        return PoolConfig(**{k: v for k, v in dict(row).items() if k in _CONFIG_FIELDS})


async def list_pool_slots(pool, platform: str) -> list[PoolSlot]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id, platform, slot_index, state, current_tenant_id,
                      assigned_at, last_activity_at, worker_pid, worker_host
               FROM pool_slots
               WHERE platform = $1
               ORDER BY slot_index""",
            platform,
        )
        return [PoolSlot(**dict(r)) for r in rows]


async def count_slots_by_state(pool, platform: str) -> dict[str, int]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT state, count(*) AS cnt
               FROM pool_slots
               WHERE platform = $1
               GROUP BY state""",
            platform,
        )
        return {r["state"]: r["cnt"] for r in rows}


async def list_platforms(pool) -> list[PoolConfig]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM pool_config ORDER BY platform"
        )
        return [
            PoolConfig(**{k: v for k, v in dict(r).items() if k in _CONFIG_FIELDS})
            for r in rows
        ]
