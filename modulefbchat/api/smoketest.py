"""
modulefbchat/api/smoketest.py — Dev-only smoke test (DEV ONLY).
POST /api/fbchat/_smoketest
  1. โหลด cookie จาก path
  2. Client.__aenter__() (startSession)
  3. is_logged_in() → return uid
  4. fetch_thread_list(limit=5) → return thread_count
  5. ไม่ listen
"""
from __future__ import annotations

import os
import time

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from fbchat_muqit import Client

router = APIRouter()


def _dev_guard(request: Request) -> None:
    if os.getenv("VIIV_DEV_MODE") == "1":
        return
    if request.headers.get("X-Dev-Mode") == "1":
        return
    raise HTTPException(403, "smoketest disabled (dev only)")


class SmokeTestRequest(BaseModel):
    cookies_path: str
    proxy_url: Optional[str] = None


@router.post("/_smoketest")
async def smoketest(body: SmokeTestRequest, request: Request):
    _dev_guard(request)

    t0 = time.perf_counter()
    client = Client(
        cookies_file_path=body.cookies_path,
        proxy=body.proxy_url,
        log_level="WARNING",
        disable_logs=True,
    )

    try:
        await client.__aenter__()
    except Exception as exc:
        raise HTTPException(500, f"session start failed: {exc}")

    try:
        uid = client.uid
        logged_in = client._state.is_logged_in() if client._state else False

        threads = []
        try:
            threads = await client.fetch_thread_list(limit=5)
        except Exception as exc:
            threads = []
            thread_error = str(exc)
        else:
            thread_error = None

        elapsed_ms = int((time.perf_counter() - t0) * 1000)

        result = {
            "success": True,
            "uid": uid,
            "logged_in": logged_in,
            "thread_count": len(threads),
            "elapsed_ms": elapsed_ms,
        }
        if thread_error:
            result["thread_error"] = thread_error
        return result

    finally:
        try:
            await client.__aexit__(None, None, None)
        except Exception:
            pass
