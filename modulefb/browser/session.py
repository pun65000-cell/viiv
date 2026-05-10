"""
Customer authorization session manager.

Bridges DB (encrypted session storage) ↔ BrowserPool (live context).

Lifecycle:
  1. Customer authorizes VIIV → save_authorized_session()
  2. VIIV needs to act → load_authorized_session() → BrowserPool
  3. After activity → state may be re-saved (Phase 3+)
  4. Facebook needs verification → mark_needs_reauth()
  5. Customer revokes → disconnect()

DB connection is injected via constructor (Phase 3+ wires up).
This Phase 2 file defines the manager class; runtime instantiation
happens once auth API arrives.
"""
import json
import logging
import sqlite3
from pathlib import Path
from typing import Any, Optional

from .crypto import decrypt_session, encrypt_session
from .pool import BrowserPool

log = logging.getLogger(__name__)


class SessionExpiredError(Exception):
    """Customer's session needs re-authorization."""
    pass


class FBSessionManager:
    """
    Manage customer's authorized Facebook session lifecycle.

    Args:
      pool: BrowserPool instance
      db: database connection (any object with `fetch_one` and
          `execute` async methods — Phase 3+ injects real one)
    """

    def __init__(self, pool: BrowserPool, db: Any):
        self.pool = pool
        self.db = db

    # ── Read ─────────────────────────────────────────────────────

    async def load_authorized_session(
        self, tenant_id: str
    ) -> Optional[dict]:
        """
        Load customer's authorized session from DB and decrypt.

        DEPRECATED (Phase 3.D.2): Profile dir is now the runtime primary.
        DB session_data_encrypted = manual backup only. Keep for future DR.

        Returns:
          dict (session_state) if active and decryptable
          None if customer has no row yet (first-time)

        Raises:
          SessionExpiredError if status != 'active' or decrypt fails
        """
        row = await self.db.fetch_one(
            """
            SELECT
                tenant_id,
                fb_user_id,
                fb_user_name,
                session_data_encrypted,
                status
            FROM fb_sessions
            WHERE tenant_id = :tid
            """,
            {"tid": tenant_id},
        )

        if not row:
            return None

        if row["status"] != "active":
            raise SessionExpiredError(
                f"Session status: {row['status']}"
            )

        if not row["session_data_encrypted"]:
            return None

        try:
            plaintext = decrypt_session(row["session_data_encrypted"])
            return json.loads(plaintext)
        except Exception as e:
            log.error(
                f"Failed to decrypt session for {tenant_id}: {e}"
            )
            raise SessionExpiredError("Decrypt failed")

    # ── Write ────────────────────────────────────────────────────

    async def save_authorized_session(
        self,
        tenant_id: str,
        session_state: dict,
        fb_user_id: str,
        fb_user_name: str,
        fb_account_type: str = "unknown",
    ):
        """
        Save customer's authorized session to DB (UPSERT).
        Called after successful authorization or session refresh.
        """
        plaintext = json.dumps(session_state)
        encrypted = encrypt_session(plaintext)

        await self.db.execute(
            """
            INSERT INTO fb_sessions (
                tenant_id, fb_user_id, fb_user_name,
                fb_account_type, session_data_encrypted,
                status, last_login_at, last_active_at
            ) VALUES (
                :tid, :uid, :name, :atype, :enc,
                'active', now(), now()
            )
            ON CONFLICT (tenant_id) DO UPDATE SET
                fb_user_id = :uid,
                fb_user_name = :name,
                fb_account_type = :atype,
                session_data_encrypted = :enc,
                status = 'active',
                last_login_at = now(),
                last_active_at = now(),
                updated_at = now()
            """,
            {
                "tid": tenant_id,
                "uid": fb_user_id,
                "name": fb_user_name,
                "atype": fb_account_type,
                "enc": encrypted,
            },
        )

        await self.audit_log(
            tenant_id, "session_saved",
            {"fb_user_id": fb_user_id},
        )

    async def mark_needs_reauth(self, tenant_id: str, reason: str):
        """
        Mark customer's session as needing re-authorization.

        Triggered when Facebook requests verification (security
        check, password change, etc.). Customer must re-login via
        the VIIV UI to restore active status.
        """
        await self.db.execute(
            """
            UPDATE fb_sessions
            SET status = 'needs_reauth',
                needs_reauth_at = now(),
                needs_reauth_reason = :reason,
                updated_at = now()
            WHERE tenant_id = :tid
            """,
            {"tid": tenant_id, "reason": reason},
        )

        # Close active context to drop the now-stale session
        await self.pool.close_context(tenant_id)

        await self.audit_log(
            tenant_id, "needs_reauth", {"reason": reason},
        )

    async def disconnect(self, tenant_id: str):
        """
        Customer revokes VIIV's access to their FB account.

        Customer right: revoke at any time. Removes encrypted session
        from DB and closes any active context.
        """
        await self.db.execute(
            """
            UPDATE fb_sessions
            SET status = 'disconnected_by_user',
                session_data_encrypted = NULL,
                api_token_encrypted = NULL,
                profile_url = NULL,
                page_url = NULL,
                fb_user_id = NULL,
                fb_user_name = NULL,
                updated_at = now()
            WHERE tenant_id = :tid
            """,
            {"tid": tenant_id},
        )

        await self.pool.close_context(tenant_id)

        await self.audit_log(tenant_id, "disconnect", {})

    # ── Login detection (Phase 3.D.4) ───────────────────────────

    async def detect_login_and_extract_profile(
        self, tenant_id: str, page
    ) -> Optional[dict]:
        """Called when user clicks 'ฉัน Login เสร็จแล้ว' in canvas UI.

        1. Read cookies from browser context
        2. Find c_user cookie → Facebook user ID
        3. If not found → return None (login not complete)
        4. Navigate to facebook.com/me → read page.url()
        5. Fallback URL: profile.php?id=<c_user>
        6. UPSERT fb_sessions: status='active', fb_user_id, profile_url
        7. Return {fb_user_id, profile_url}
        """
        # Get all cookies from the persistent browser context
        cookies = await page.context.cookies()
        c_user = next(
            (c["value"] for c in cookies
             if c["name"] == "c_user" and "facebook.com" in c.get("domain", "")),
            None,
        )

        if not c_user:
            await self.audit_log(tenant_id, "login_not_detected", {"reason": "no_c_user"})
            return None

        # Navigate to /me to get the canonical profile URL
        profile_url = f"https://www.facebook.com/profile.php?id={c_user}"
        try:
            await page.goto("https://www.facebook.com/me", timeout=15_000)
            await page.wait_for_load_state("domcontentloaded", timeout=10_000)
            final_url = page.url
            # Use final URL if it's a real profile page (not a login/checkpoint redirect)
            if (final_url and "facebook.com" in final_url
                    and "/login" not in final_url
                    and "/checkpoint" not in final_url
                    and "/me" not in final_url):
                profile_url = final_url
        except Exception as e:
            log.warning("navigate to /me failed for %s: %s", tenant_id, e)

        await self.db.execute(
            """
            UPDATE fb_sessions SET
                status         = 'active',
                fb_user_id     = :uid,
                profile_url    = :purl,
                last_login_at  = NOW(),
                last_active_at = NOW(),
                updated_at     = NOW()
            WHERE tenant_id = :tid
            """,
            {"tid": tenant_id, "uid": c_user, "purl": profile_url},
        )

        await self.audit_log(
            tenant_id, "login_detected",
            {"fb_user_id": c_user, "profile_url": profile_url, "method": "c_user_cookie"},
        )

        return {"fb_user_id": c_user, "profile_url": profile_url}

    # ── Snapshot (Phase 3.D.2) ───────────────────────────────────

    async def snapshot_profile_to_db(
        self, tenant_id: str, profile_dir: Path
    ) -> dict:
        """Manual snapshot — read Chromium Cookies SQLite, encrypt, UPSERT DB.

        Profile dir = runtime primary (Option B'). DB snapshot = disaster
        recovery only. Call manually; never auto-synced.

        Returns: {tenant_id, bytes_encrypted, cookies_count}
        """
        cookies_db = profile_dir / "Default" / "Cookies"
        cookies: list[dict] = []

        if cookies_db.exists():
            conn = sqlite3.connect(f"file:{cookies_db}?mode=ro", uri=True)
            try:
                cur = conn.cursor()
                cur.execute(
                    "SELECT host_key, name, value, path, expires_utc, "
                    "is_secure, is_httponly, samesite FROM cookies"
                )
                for row in cur.fetchall():
                    cookies.append({
                        "domain": row[0], "name": row[1], "value": row[2],
                        "path": row[3], "expires": row[4],
                        "secure": bool(row[5]), "httpOnly": bool(row[6]),
                        "sameSite": row[7],
                    })
            finally:
                conn.close()

        storage_state = {"cookies": cookies, "origins": []}
        encrypted = encrypt_session(json.dumps(storage_state))

        await self.db.execute(
            """
            UPDATE fb_sessions
            SET session_data_encrypted = :data,
                encryption_key_id      = :key_id,
                updated_at             = NOW()
            WHERE tenant_id = :tid
            """,
            {"tid": tenant_id, "data": encrypted, "key_id": "v1"},
        )

        await self.audit_log(
            tenant_id, "snapshot_to_db",
            {"cookies_count": len(cookies), "bytes": len(encrypted)},
        )

        return {
            "tenant_id": tenant_id,
            "bytes_encrypted": len(encrypted),
            "cookies_count": len(cookies),
        }

    # ── Audit ────────────────────────────────────────────────────

    async def audit_log(
        self,
        tenant_id: str,
        action: str,
        detail: dict,
        target_id: Optional[str] = None,
    ):
        """
        Log every action VIIV did on customer's behalf.
        Customer can review the audit log via Phase 3+ UI.
        """
        await self.db.execute(
            """
            INSERT INTO fb_audit_log
                (tenant_id, action, target_id, detail)
            VALUES (:tid, :act, :target, CAST(:detail AS jsonb))
            """,
            {
                "tid": tenant_id,
                "act": action,
                "target": target_id,
                "detail": json.dumps(detail),
            },
        )
