"""Session lifecycle endpoints: start, status, destroy."""
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from fastapi.responses import JSONResponse

from ..auth import sign_session_cookie, verify_tenant_token
from ..models import DestroyResponse, SessionStatusResponse, StartSessionRequest, StartSessionResponse

logger = logging.getLogger("modulecookie.session")
router = APIRouter()

SESSION_COOKIE_NAME = "viiv_browser_session"


def _get_manager(request: Request):
    return request.app.state.manager


@router.post("/session/start", response_model=StartSessionResponse)
async def start_session(
    body: StartSessionRequest,
    response: Response,
    authorization: str = Header(...),
    manager=Depends(_get_manager),
):
    try:
        payload = verify_tenant_token(authorization)
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

    # Enforce: JWT tenant must match request tenant
    if payload["tenant_id"] != body.tenant_id:
        raise HTTPException(status_code=403, detail="tenant_id mismatch")

    try:
        info = await manager.start_session(body.tenant_id)
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))

    cookie_value = sign_session_cookie(info.session_id, info.tenant_id)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=cookie_value,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=600,
        path="/browser",
    )

    url = manager.get_browser_url(info.session_id)
    return StartSessionResponse(
        session_id=info.session_id,
        url=url,
        expires_at=info.expires_at,
    )


@router.get("/session/status", response_model=SessionStatusResponse)
async def session_status(manager=Depends(_get_manager)):
    status = await manager.get_status()
    return SessionStatusResponse(**status)


@router.delete("/session/{session_id}", response_model=DestroyResponse)
async def destroy_session(
    session_id: str,
    authorization: str = Header(...),
    manager=Depends(_get_manager),
):
    try:
        verify_tenant_token(authorization)
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

    try:
        await manager.destroy_session(session_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return DestroyResponse(status="destroyed", session_id=session_id)
