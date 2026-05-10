"""Graph API helpers — token verification, profile fetch."""
import httpx
from typing import Optional

GRAPH_API_VERSION = "v20.0"
GRAPH_BASE = f"https://graph.facebook.com/{GRAPH_API_VERSION}"
TIMEOUT = 10.0


async def verify_fb_token(token: str) -> Optional[dict]:
    """
    Call /me endpoint to verify token validity.
    Returns dict {id, name, category?, is_page} if valid, None if invalid.
    category present → Page token, absent → User token.
    """
    if not token or not token.strip():
        return None
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.get(
                f"{GRAPH_BASE}/me",
                params={
                    "access_token": token.strip(),
                    "fields": "id,name,category",
                },
            )
            if r.status_code != 200:
                return None
            data = r.json()
            if not data.get("id"):
                return None
            return {
                "id": str(data["id"]),
                "name": data.get("name", ""),
                "category": data.get("category"),
                "is_page": "category" in data,
            }
    except Exception:
        return None
