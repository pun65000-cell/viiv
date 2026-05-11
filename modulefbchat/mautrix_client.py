"""
modulefbchat/mautrix_client.py — mautrix-meta provisioning API client.

Multi-tenant admin mode: shared_secret Bearer + ?user_id=MXID for all calls.
All callers resolve MXID via mxid_for_tenant() before calling these functions.

Confirmed API endpoints (mautrix-meta v26.04):
  GET  /v3/whoami                                        — bridge info
  GET  /v3/login/flows                                   — available flows
  GET  /v3/logins                                        — active FB sessions
  POST /v3/login/start/{flow_id}                         — start login → first step
  POST /v3/login/step/{login_id}/{step_id}/{step_type}   — submit step data
  DELETE /v3/logins/{fb_login_id}                        — logout
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import httpx

log = logging.getLogger("modulefbchat.mautrix_client")

MAUTRIX_URL = os.getenv("MAUTRIX_URL", "http://localhost:8009")
MAUTRIX_PROVISIONING_SECRET = os.getenv("MAUTRIX_PROVISIONING_SECRET", "")
HOMESERVER_NAME = os.getenv("MATRIX_HOMESERVER_NAME", "viiv.local")
_FLOW_ID = "messenger"
_BASE = f"{MAUTRIX_URL}/_matrix/provision/v3"


def mxid_for_tenant(tenant_id: str) -> str:
    return f"@fb_{tenant_id}:{HOMESERVER_NAME}"


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {MAUTRIX_PROVISIONING_SECRET}",
        "Content-Type": "application/json",
    }


async def whoami(mxid: str) -> dict:
    """GET /v3/whoami — bridge capabilities and login state for this MXID."""
    async with httpx.AsyncClient(timeout=10.0) as c:
        r = await c.get(
            f"{_BASE}/whoami",
            params={"user_id": mxid},
            headers=_headers(),
        )
        r.raise_for_status()
        return r.json()


async def get_login_flows(mxid: str) -> list[dict]:
    """GET /v3/login/flows — available login methods."""
    async with httpx.AsyncClient(timeout=10.0) as c:
        r = await c.get(
            f"{_BASE}/login/flows",
            params={"user_id": mxid},
            headers=_headers(),
        )
        r.raise_for_status()
        return r.json().get("flows", [])


async def list_logins(mxid: str) -> list[str]:
    """GET /v3/logins — active FB login IDs (FB user IDs) for this MXID."""
    async with httpx.AsyncClient(timeout=10.0) as c:
        r = await c.get(
            f"{_BASE}/logins",
            params={"user_id": mxid},
            headers=_headers(),
        )
        r.raise_for_status()
        return r.json().get("login_ids", [])


async def start_login(mxid: str) -> dict:
    """POST /v3/login/start/messenger — begin FB cookie login flow.

    Returns first step dict:
      {
        "login_id": "<process_id>",
        "type": "cookies",
        "step_id": "fi.mau.meta.cookies",
        "instructions": "...",
        "cookies": {"fields": [...], "url": "...", ...}
      }
    """
    async with httpx.AsyncClient(timeout=15.0) as c:
        r = await c.post(
            f"{_BASE}/login/start/{_FLOW_ID}",
            params={"user_id": mxid},
            headers=_headers(),
        )
        r.raise_for_status()
        data = r.json()
        log.info("Started login process login_id=%s mxid=%s", data.get("login_id"), mxid)
        return data


async def submit_cookies(
    mxid: str,
    login_id: str,
    step_id: str,
    cookies: dict,
) -> dict:
    """POST /v3/login/step/{login_id}/{step_id}/cookies — submit FB cookies.

    cookies must contain at least: xs, c_user, datr
    Returns next step or completion:
      {"type": "complete", "step_id": "fi.mau.meta.complete", ...}
    """
    async with httpx.AsyncClient(timeout=30.0) as c:
        r = await c.post(
            f"{_BASE}/login/step/{login_id}/{step_id}/cookies",
            params={"user_id": mxid},
            headers=_headers(),
            json=cookies,
        )
        if r.status_code >= 400:
            body = r.json()
            log.warning(
                "submit_cookies failed mxid=%s login_id=%s status=%d body=%s",
                mxid, login_id, r.status_code, body,
            )
            r.raise_for_status()
        data = r.json()
        log.info(
            "Login step result mxid=%s login_id=%s type=%s",
            mxid, login_id, data.get("type"),
        )
        return data


async def logout(mxid: str, fb_login_id: str) -> None:
    """DELETE /v3/logins/{fb_login_id} — log out of Facebook.

    fb_login_id is the FB user ID (e.g. '61589536772585'), not the process ID.
    """
    async with httpx.AsyncClient(timeout=10.0) as c:
        r = await c.delete(
            f"{_BASE}/logins/{fb_login_id}",
            params={"user_id": mxid},
            headers=_headers(),
        )
        r.raise_for_status()
        log.info("Logged out mxid=%s fb_login_id=%s", mxid, fb_login_id)
