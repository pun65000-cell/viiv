# LINE media downloader (sync — used by app.api.pos_line per-tenant webhook)
# Spawns a daemon thread that pulls binary content from LINE
# (api-data.line.me/v2/bot/message/{id}/content), saves under
# /uploads/line/{tenant}/{conv}/{message_id}.{ext}, then patches
# chat_messages.raw_event with media_url.
import os, re, threading, logging
import requests
from sqlalchemy import text
from app.core.db import engine

_log = logging.getLogger("line_content")

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


def _download_and_save(channel_token, message_id, msg_type, tenant_id, conv_id, file_name=""):
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

        r = requests.get(
            f"https://api-data.line.me/v2/bot/message/{mid}/content",
            headers={"Authorization": f"Bearer {channel_token}"},
            timeout=30,
            stream=True,
        )
        if r.status_code != 200:
            _log.warning("[line_media] download HTTP %d msg=%s", r.status_code, mid)
            return
        with open(target_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=65536):
                if chunk:
                    f.write(chunk)

        with engine.begin() as c:
            c.execute(text("""
                UPDATE chat_messages
                   SET raw_event = jsonb_set(
                           COALESCE(raw_event, '{}'::jsonb),
                           '{media_url}',
                           to_jsonb(:url::text)
                       )
                 WHERE raw_event->>'message_id' = :mid
            """), {"url": media_url, "mid": mid})

        _log.info("[line_media] saved %s → %s", mid, target_path)
    except Exception as e:
        _log.warning("[line_media] failed msg=%s: %s", message_id, e)


def spawn_download(channel_token, message_id, msg_type, tenant_id, conv_id, file_name=""):
    """Fire-and-forget. Safe to call from request handlers — never blocks."""
    if msg_type not in _DOWNLOADABLE:
        return
    if not (channel_token and message_id):
        return
    threading.Thread(
        target=_download_and_save,
        args=(channel_token, message_id, msg_type, tenant_id, conv_id, file_name),
        daemon=True,
    ).start()
