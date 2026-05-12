"""
Cookie extraction from Firefox sandbox container.

Paradigm:
  - docker cp firefox-{session_id}:/config/profile/cookies.sqlite → /dev/shm/
  - Parse SQLite, filter facebook.com cookies
  - Validate required fields (xs, c_user, datr)
  - Cleanup tmpfs guaranteed via try/finally
"""

import asyncio
import logging
import os
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

log = logging.getLogger(__name__)


@dataclass
class FBCookies:
    xs: str
    c_user: str
    datr: str

    def to_dict(self) -> dict:
        return {"xs": self.xs, "c_user": self.c_user, "datr": self.datr}

    def __repr__(self) -> str:
        return (
            f"FBCookies(xs=<{len(self.xs)}b>, "
            f"c_user=<{len(self.c_user)}b>, "
            f"datr=<{len(self.datr)}b>)"
        )


class CookieExtractionError(Exception):
    """Base error for extraction failures."""


class ContainerNotFoundError(CookieExtractionError):
    """Firefox container ไม่มีอยู่ / stopped."""


class CookiesNotFoundError(CookieExtractionError):
    """SQLite อ่านได้แต่ไม่มี xs/c_user/datr ของ facebook.com (= ยังไม่ login)."""


class CookiesCorruptedError(CookieExtractionError):
    """SQLite อ่านไม่ได้ / schema ผิด / encrypted."""


async def extract_cookies(session_id: str, container_name: str) -> FBCookies:
    """
    Extract FB cookies จาก Firefox sandbox container.

    Steps:
      1. docker cp cookies.sqlite → /dev/shm/cookie-extract-{session_id}/
      2. chmod 0o600 (defense-in-depth — tmpfs is RAM)
      3. Open SQLite read-only
      4. Query host LIKE '%facebook.com' (รวม subdomains)
      5. Validate xs + c_user + datr ครบ + format ถูก
      6. Cleanup tmpfs (always, finally block)

    Args:
        session_id:     from SessionManager.session
        container_name: e.g. "firefox-abc123"

    Returns:
        FBCookies(xs, c_user, datr) — plaintext, ready for backend

    Raises:
        ContainerNotFoundError:  container stopped / not exist
        CookiesNotFoundError:    SQLite ok but FB cookies missing (user ยังไม่ login)
        CookiesCorruptedError:   SQLite read failure
    """
    tmpfs_dir = Path(f"/dev/shm/cookie-extract-{session_id}")
    sqlite_path = tmpfs_dir / "cookies.sqlite"

    try:
        tmpfs_dir.mkdir(mode=0o700, exist_ok=False)
        os.chmod(tmpfs_dir, 0o700)

        # 1. docker cp
        await _docker_cp_cookies(container_name, sqlite_path)
        os.chmod(sqlite_path, 0o600)

        # 2. parse SQLite
        parsed = _parse_sqlite(sqlite_path)

        # 3. validate + return FBCookies
        fb_cookies = _validate_fb_cookies(parsed)

        log.info("extract_cookies session=%s ok %s", session_id, fb_cookies)
        return fb_cookies

    finally:
        # cleanup ALWAYS — แม้ raise exception
        try:
            if sqlite_path.exists():
                sqlite_path.unlink()
            for suffix in ("-journal", "-wal", "-shm"):
                p = sqlite_path.with_name(sqlite_path.name + suffix)
                if p.exists():
                    p.unlink()
            if tmpfs_dir.exists():
                tmpfs_dir.rmdir()
        except OSError as e:
            log.warning("cleanup failed session=%s err=%s", session_id, e)


async def _docker_cp_cookies(container_name: str, dest: Path) -> None:
    """Run `docker cp {container}:/config/profile/cookies.sqlite {dest}`."""
    proc = await asyncio.create_subprocess_exec(
        "docker", "cp",
        f"{container_name}:/config/profile/cookies.sqlite",
        str(dest),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        err = stderr.decode("utf-8", errors="replace").strip()
        if "No such container" in err or "is not running" in err:
            raise ContainerNotFoundError(f"container={container_name}: {err}")
        raise CookieExtractionError(f"docker cp failed: {err}")

    if not dest.exists() or dest.stat().st_size == 0:
        raise CookiesCorruptedError("docker cp success but file missing/empty")


def _parse_sqlite(path: Path) -> dict:
    """Read moz_cookies, return {name: value} for facebook.com hosts."""
    try:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=2.0)
    except sqlite3.Error as e:
        raise CookiesCorruptedError(f"sqlite open: {e}") from e

    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT name, value, host FROM moz_cookies "
            "WHERE host LIKE '%facebook.com' OR host LIKE '%.facebook.com'"
        )
        rows = cur.fetchall()
    except sqlite3.Error as e:
        raise CookiesCorruptedError(f"sqlite query: {e}") from e
    finally:
        conn.close()

    result: dict[str, str] = {}
    for name, value, host in rows:
        if name not in result:
            result[name] = value
        elif host.startswith("."):  # generic domain wins
            result[name] = value

    return result


def _validate_fb_cookies(parsed: dict) -> FBCookies:
    """Ensure xs + c_user + datr present and well-formed."""
    missing = [k for k in ("xs", "c_user", "datr") if k not in parsed]
    if missing:
        raise CookiesNotFoundError(f"missing cookies: {missing}")

    xs = parsed["xs"]
    c_user = parsed["c_user"]
    datr = parsed["datr"]

    if not c_user.isdigit():
        raise CookiesNotFoundError(f"c_user not numeric: <{len(c_user)}b>")
    if len(c_user) < 10 or len(c_user) > 20:
        raise CookiesNotFoundError(f"c_user wrong length: <{len(c_user)}b>")
    if len(xs) < 40 or len(xs) > 200:
        raise CookiesNotFoundError(f"xs wrong length: <{len(xs)}b>")
    if len(datr) < 20 or len(datr) > 40:
        raise CookiesNotFoundError(f"datr wrong length: <{len(datr)}b>")

    return FBCookies(xs=xs, c_user=c_user, datr=datr)
