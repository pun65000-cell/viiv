"""
modulefbchat/api/poll.py — Poll loop management endpoints (dev only).
"""
from __future__ import annotations

import os
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from ..poll_loop import register_room, unregister_room, list_rooms

router = APIRouter()


def _dev_guard(request: Request) -> None:
    if os.getenv("VIIV_DEV_MODE") == "1":
        return
    if request.headers.get("X-Dev-Mode") == "1":
        return
    raise HTTPException(403, "poll endpoints disabled (dev only)")


class RegisterRequest(BaseModel):
    room_id: str
    tenant_id: str


@router.post("/poll/register")
async def poll_register(body: RegisterRequest, request: Request):
    """Register a Matrix room into the poll loop (dev only)."""
    _dev_guard(request)
    register_room(room_id=body.room_id, tenant_id=body.tenant_id)
    return {"ok": True, "registered": True, "room_id": body.room_id, "tenant_id": body.tenant_id}


@router.delete("/poll/register/{room_id}")
async def poll_unregister(room_id: str, request: Request):
    """Remove a Matrix room from the poll loop (dev only)."""
    _dev_guard(request)
    unregister_room(room_id)
    return {"ok": True, "unregistered": True, "room_id": room_id}


@router.get("/poll/rooms")
async def poll_rooms(request: Request):
    """List all registered rooms (dev only)."""
    _dev_guard(request)
    return {"ok": True, "rooms": list_rooms()}
