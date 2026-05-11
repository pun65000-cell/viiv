"""
modulefbchat/matrix_admin.py — Provision Matrix users on Synapse
via shared-secret registration (nonce + HMAC-SHA1 flow).
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger("modulefbchat.matrix_admin")

SYNAPSE_URL = os.getenv("SYNAPSE_URL", "http://localhost:8008")
SHARED_SECRET = os.getenv("SYNAPSE_REGISTRATION_SHARED_SECRET")
HOMESERVER_NAME = os.getenv("MATRIX_HOMESERVER_NAME", "viiv.local")

if not SHARED_SECRET:
    logger.warning(
        "SYNAPSE_REGISTRATION_SHARED_SECRET not set — "
        "register_matrix_user() will fail at runtime"
    )


async def get_registration_nonce() -> str:
    """GET /_synapse/admin/v1/register → return nonce string."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(f"{SYNAPSE_URL}/_synapse/admin/v1/register")
        r.raise_for_status()
        data = r.json()
        if "nonce" not in data:
            raise ValueError(f"Synapse register response missing 'nonce': {data}")
        return data["nonce"]


def compute_registration_mac(
    nonce: str,
    username: str,
    password: str,
    admin: bool = False,
) -> str:
    """
    HMAC-SHA1 of:
      nonce NUL username NUL password NUL admin_str
    where admin_str = "admin" if admin else "notadmin"
    """
    if not SHARED_SECRET:
        raise RuntimeError("SYNAPSE_REGISTRATION_SHARED_SECRET not set")
    admin_str = "admin" if admin else "notadmin"
    mac = hmac.new(SHARED_SECRET.encode("utf-8"), digestmod=hashlib.sha1)
    mac.update(nonce.encode("utf-8"))
    mac.update(b"\x00")
    mac.update(username.encode("utf-8"))
    mac.update(b"\x00")
    mac.update(password.encode("utf-8"))
    mac.update(b"\x00")
    mac.update(admin_str.encode("utf-8"))
    return mac.hexdigest()


async def register_matrix_user(
    tenant_id: str,
    password: Optional[str] = None,
) -> dict:
    """
    Register a Matrix user for the given tenant.

    Username: fb_{tenant_id}
    MXID:     @fb_{tenant_id}:{HOMESERVER_NAME}
    Password: auto-generated if not provided (os.urandom(24).hex())

    Returns dict with mxid, access_token, device_id, is_new.
    If user already exists: access_token=None, is_new=False,
    error="user_exists_no_token" (caller must handle).
    """
    username = f"fb_{tenant_id}"
    if password is None:
        password = os.urandom(24).hex()

    nonce = await get_registration_nonce()
    mac = compute_registration_mac(nonce, username, password, admin=False)

    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(
            f"{SYNAPSE_URL}/_synapse/admin/v1/register",
            json={
                "nonce": nonce,
                "username": username,
                "password": password,
                "admin": False,
                "mac": mac,
            },
        )

        if r.status_code == 200:
            data = r.json()
            mxid = data["user_id"]
            token = data["access_token"]
            device_id = data.get("device_id")
            logger.info(
                "Registered Matrix user mxid=%s device_id=%s is_new=True",
                mxid, device_id,
            )
            return {
                "mxid": mxid,
                "access_token": token,
                "device_id": device_id,
                "is_new": True,
            }

        if r.status_code == 400:
            body = r.json()
            if body.get("errcode") == "M_USER_IN_USE":
                mxid = f"@{username}:{HOMESERVER_NAME}"
                logger.info(
                    "Matrix user already exists mxid=%s — returning no token", mxid
                )
                return {
                    "mxid": mxid,
                    "access_token": None,
                    "device_id": None,
                    "is_new": False,
                    "error": "user_exists_no_token",
                }

        logger.error(
            "register_matrix_user failed status=%d body=%s",
            r.status_code, r.text[:500],
        )
        r.raise_for_status()
        return {}  # unreachable


async def verify_access_token(access_token: str) -> dict:
    """
    GET /_matrix/client/v3/account/whoami
    Returns JSON with user_id, device_id.
    Raises httpx.HTTPStatusError on 401/403.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(
            f"{SYNAPSE_URL}/_matrix/client/v3/account/whoami",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        r.raise_for_status()
        return r.json()
