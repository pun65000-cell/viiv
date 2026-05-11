"""Internal pool management API endpoints (Phase C.3)."""
import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from ..manager import (
    request_session,
    evict_slot,
    cool_slot,
    reheat_slot,
    heartbeat,
    mark_dead,
    PoolManagerError,
)

logger = logging.getLogger("modulepool.api.request_slot")
router = APIRouter(prefix="/pool/internal", tags=["pool-internal"])

_VALID_PREFIXES = ("ten_", "test_", "stf_")


class RequestBody(BaseModel):
    tenant_id: str
    platform: str = "facebook"


class SlotOpBody(BaseModel):
    slot_id: int
    reason: str = "manual"


class HeartbeatBody(BaseModel):
    slot_id: int


@router.post("/request")
async def post_request(req: Request, body: RequestBody):
    """Allocate or return existing slot for tenant."""
    pool = req.app.state.db
    if not any(body.tenant_id.startswith(p) for p in _VALID_PREFIXES):
        raise HTTPException(400, "invalid tenant_id prefix")
    try:
        return await request_session(pool, body.tenant_id, body.platform)
    except PoolManagerError as e:
        raise HTTPException(409, f"pool error: {e}")
    except Exception as e:
        logger.exception("request_session failed")
        raise HTTPException(500, f"internal: {e}")


@router.post("/release")
async def post_release(req: Request, body: SlotOpBody):
    """Evict slot → empty."""
    pool = req.app.state.db
    try:
        return await evict_slot(pool, body.slot_id, reason=body.reason)
    except PoolManagerError as e:
        raise HTTPException(409, f"pool error: {e}")


@router.post("/cool")
async def post_cool(req: Request, body: SlotOpBody):
    """Transition slot active → cooling."""
    pool = req.app.state.db
    try:
        return await cool_slot(pool, body.slot_id, reason=body.reason)
    except PoolManagerError as e:
        raise HTTPException(409, f"pool error: {e}")


@router.post("/reheat")
async def post_reheat(req: Request, body: SlotOpBody):
    """Transition slot cooling → active."""
    pool = req.app.state.db
    try:
        return await reheat_slot(pool, body.slot_id)
    except PoolManagerError as e:
        raise HTTPException(409, f"pool error: {e}")


@router.post("/heartbeat")
async def post_heartbeat(req: Request, body: HeartbeatBody):
    """Touch last_activity_at for active/cooling slot."""
    pool = req.app.state.db
    try:
        return await heartbeat(pool, body.slot_id)
    except PoolManagerError as e:
        raise HTTPException(409, f"pool error: {e}")


@router.post("/mark_dead")
async def post_mark_dead(req: Request, body: SlotOpBody):
    """Mark slot dead (health check failed)."""
    pool = req.app.state.db
    try:
        return await mark_dead(pool, body.slot_id, reason=body.reason)
    except PoolManagerError as e:
        raise HTTPException(409, f"pool error: {e}")
