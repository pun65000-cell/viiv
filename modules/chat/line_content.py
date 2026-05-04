# LINE media downloader (async — used by modules.chat.line_webhook for platform OA)
# Mirrors app/api/line_content.py but runs as asyncio task inside the modules.chat
# event loop. Kept as a standalone module because modules/chat/ may not have
# app/ on its Python path during all import contexts.
import os, re, asyncio, logging
import httpx
from sqlalchemy import text
from .db import AsyncSessionLocal

_log = logging.getLogger("line_content_chat")

_EXT_MAP = {"image": "jpg", "video": "mp4", "audio": "m4a"}
_DOWNLOADABLE = {"image", "video", "audio", "file"}
UPLOAD_ROOT = "/home/viivadmin/viiv/uploads/line"


def _safe_ext(s: str) -> str:
    return (re.sub(r"[^a-zA-Z0-9]", "", s or "")[:8]).lower() or "bin"


def _safe_id(s: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "", s or "")[:64]


def _resolve_ext(msg_type: str, file_name: str = "") -> str:
    if msg_type == "file" and file_name and "." in file_name:
        return _safe_ext(file_name.rsplit(".", 1)[-1])
    return _EXT_MAP.get(msg_type, "bin")


async def _download_and_save(channel_token, message_id, msg_type, tenant_id, conv_id, file_name=""):
    try:
        if not (channel_token and message_id):
            return
        mid = _safe_id(message_id)
        tid = _safe_id(tenant_id) or "platform"
        cid = _safe_id(conv_id) or "_"
        ext = _resolve_ext(msg_type, file_name)

        target_dir = f"{UPLOAD_ROOT}/{tid}/{cid}"
        os.makedirs(target_dir, exist_ok=True)
        target_path = f"{target_dir}/{mid}.{ext}"
        media_url = f"/uploads/line/{tid}/{cid}/{mid}.{ext}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(
                f"https://api-data.line.me/v2/bot/message/{mid}/content",
                headers={"Authorization": f"Bearer {channel_token}"},
            )
            if r.status_code != 200:
                _log.warning("[line_media] download HTTP %d msg=%s", r.status_code, mid)
                return
            with open(target_path, "wb") as f:
                f.write(r.content)
        file_size = os.path.getsize(target_path)

        # Use CAST(... AS type) instead of `::type` — `::` collides with SQLAlchemy
        # text() parameter parser (`:url::text` is misread as `:url` followed by an
        # unfinished cast, raising psycopg2 SyntaxError).
        async with AsyncSessionLocal() as db:
            await db.execute(
                text("""
                    UPDATE chat_messages
                       SET raw_event = jsonb_set(
                               jsonb_set(
                                   COALESCE(raw_event, '{}'::jsonb),
                                   '{media_url}',
                                   to_jsonb(CAST(:url AS text))
                               ),
                               '{media_size}',
                               to_jsonb(CAST(:size AS bigint))
                           )
                     WHERE raw_event->>'message_id' = :mid
                """),
                {"url": media_url, "size": file_size, "mid": mid},
            )
            await db.commit()

        _log.info("[line_media] saved %s → %s", mid, target_path)
    except Exception as e:
        _log.warning("[line_media] failed msg=%s: %s", message_id, e)


def spawn_download(channel_token, message_id, msg_type, tenant_id, conv_id, file_name=""):
    """Fire-and-forget asyncio task. Safe inside an event-loop request handler."""
    if msg_type not in _DOWNLOADABLE:
        return
    if not (channel_token and message_id):
        return
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    loop.create_task(
        _download_and_save(channel_token, message_id, msg_type, tenant_id, conv_id, file_name)
    )
