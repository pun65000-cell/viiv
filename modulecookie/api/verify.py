"""Caddy forward_auth endpoint — verify viiv_browser_session cookie."""
import logging

from fastapi import APIRouter, Cookie, HTTPException, Request
from typing import Optional

from ..auth import verify_session_cookie
from ..manager import SessionManager

logger = logging.getLogger("modulecookie.verify")
router = APIRouter()

SESSION_COOKIE_NAME = "viiv_browser_session"


def _get_manager(request: Request) -> SessionManager:
    return request.app.state.manager


@router.get("/_verify")
async def verify_session(
    request: Request,
    viiv_browser_session: Optional[str] = Cookie(default=None),
):
    if not viiv_browser_session:
        raise HTTPException(status_code=401, detail="no session cookie")

    try:
        claims = verify_session_cookie(viiv_browser_session)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    manager: SessionManager = _get_manager(request)
    status = await manager.get_status()
    if not status["alive"]:
        raise HTTPException(status_code=401, detail="session expired")

    if status.get("session_id") != claims["session_id"]:
        raise HTTPException(status_code=401, detail="session mismatch")

    return {"ok": True, "session_id": claims["session_id"]}
