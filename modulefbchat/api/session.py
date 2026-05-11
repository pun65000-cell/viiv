"""
modulefbchat/api/session.py — Connect / disconnect / status endpoints.
"""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from ..auth import verify_tenant_token

router = APIRouter()


class ConnectRequest(BaseModel):
    cookies_path: str
    http_proxy: Optional[str] = None


@router.post("/session/connect")
async def connect_session(
    body: ConnectRequest,
    request: Request,
    authorization: str = Header(""),
):
    claims = verify_tenant_token(authorization)
    tenant_id = claims["tenant_id"]
    manager = request.app.state.manager

    try:
        client = await manager.connect(
            tenant_id=tenant_id,
            cookies_path=body.cookies_path,
            http_proxy=body.http_proxy,
        )
        logged_in = await client.is_logged_in()
        return {"ok": True, "tenant_id": tenant_id, "uid": client.uid, "logged_in": logged_in}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/session/disconnect")
async def disconnect_session(
    request: Request,
    authorization: str = Header(""),
):
    claims = verify_tenant_token(authorization)
    tenant_id = claims["tenant_id"]
    manager = request.app.state.manager
    await manager.disconnect(tenant_id)
    return {"ok": True, "tenant_id": tenant_id}


@router.get("/session/status")
async def session_status(
    request: Request,
    authorization: str = Header(""),
):
    claims = verify_tenant_token(authorization)
    tenant_id = claims["tenant_id"]
    manager = request.app.state.manager
    return {"ok": True, "tenant_id": tenant_id, **manager.status(tenant_id)}
