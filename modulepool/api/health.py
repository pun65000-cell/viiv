"""Health + pool status endpoints (Phase C.2 — read-only)."""
import logging
from dataclasses import asdict

from fastapi import APIRouter, HTTPException, Request

from ..models import get_pool_config, list_pool_slots, count_slots_by_state, list_platforms

logger = logging.getLogger("modulepool.health")
router = APIRouter()


@router.get("/health")
async def health(request: Request):
    """Basic health check + DB connectivity."""
    try:
        pool = request.app.state.db
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return {"status": "ok", "db": "ok", "phase": "C.2"}
    except Exception as e:
        logger.error("Health check failed: %s", e)
        raise HTTPException(503, f"unhealthy: {e}")


@router.get("/pool/platforms")
async def pool_platforms(request: Request):
    """List all configured platforms."""
    pool = request.app.state.db
    configs = await list_platforms(pool)
    return {
        "platforms": [
            {
                "platform": c.platform,
                "baseline_size": c.baseline_size,
                "max_size": c.max_size,
                "min_size": c.min_size,
                "enabled": c.enabled,
            }
            for c in configs
        ]
    }


@router.get("/pool/status")
async def pool_status(request: Request, platform: str = "facebook"):
    """Read-only view of pool state for a platform."""
    pool = request.app.state.db

    config = await get_pool_config(pool, platform)
    if not config:
        raise HTTPException(404, f"no config for platform={platform}")

    slots_count = await count_slots_by_state(pool, platform)
    slots_list = await list_pool_slots(pool, platform)

    return {
        "platform": platform,
        "config": {
            "baseline_size": config.baseline_size,
            "max_size": config.max_size,
            "min_size": config.min_size,
            "eviction_idle_min": config.eviction_idle_min,
            "cooling_grace_min": config.cooling_grace_min,
            "enabled": config.enabled,
        },
        "slots_summary": slots_count,
        "slots_detail": [
            {
                "slot_index": s.slot_index,
                "state": s.state,
                "current_tenant_id": s.current_tenant_id,
            }
            for s in slots_list
        ],
    }
