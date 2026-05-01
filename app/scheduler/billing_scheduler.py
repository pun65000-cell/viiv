# app/scheduler/billing_scheduler.py — daily billing check (Phase 4)
# Runs at 09:00 Asia/Bangkok. DRY_RUN by default — set BILLING_SCHEDULER_DRY_RUN=0 to send.

import os
import datetime
from sqlalchemy import text
from app.core.db import engine
from app.api.billing import (
    NOTIFY_TEMPLATES,
    _platform_line_token,
    notify_tenant_line,
    _days_remaining,
)


def _dry_run() -> bool:
    """Read each call so env changes don't need a restart for the value."""
    return os.getenv("BILLING_SCHEDULER_DRY_RUN", "1") == "1"


def _pick_template(bs: str, days_left: int | None) -> str | None:
    """Schedule-day picker (stricter than admin-manual _select_notify_type).
    Fires only on the exact days per spec."""
    if days_left is None:
        return None
    if bs == "trial":
        if days_left == 2:
            return "trial_warning"
        if days_left == 0:
            return "trial_expiry"
        return None
    if bs == "active":
        if days_left == 3:
            return "expiry_warning_3d"
        if days_left == 1:
            return "expiry_warning_1d"
        if days_left < 0 and abs(days_left) in (2, 4, 6):
            return "overdue"
        return None
    return None


def _should_suspend(bs: str, days_left: int | None) -> bool:
    if days_left is None:
        return False
    if bs == "trial" and days_left < 0:
        return True
    if bs == "active" and days_left < 0 and abs(days_left) >= 7:
        return True
    return False


def check_billing() -> dict:
    """One pass over active tenants: suspend overdue, send notifications.
    Idempotent within the same day via billing_notifications dedup."""
    dry = _dry_run()
    summary: dict = {
        "ts":                datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "dry_run":           dry,
        "checked":           0,
        "notified":          [],
        "suspended":         [],
        "skipped_duplicate": 0,
        "skipped_no_line":   [],
        "errors":            [],
    }

    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT id, line_uid, billing_status,
                   trial_ends_at, subscription_ends_at
            FROM tenants
            WHERE status = 'active'
        """)).mappings().all()

    summary["checked"] = len(rows)
    token = _platform_line_token() if not dry else ""

    for r in rows:
        tid       = r["id"]
        bs        = r["billing_status"] or "trial"
        deadline  = r["trial_ends_at"] if bs == "trial" else r["subscription_ends_at"]
        days_left = _days_remaining(deadline)

        # 1) Suspension takes precedence — no notification on suspend day
        if _should_suspend(bs, days_left):
            if dry:
                summary["suspended"].append({"tenant_id": tid, "dry": True,
                                             "billing_status": bs, "days_left": days_left})
                continue
            try:
                with engine.begin() as c:
                    c.execute(text("""
                        UPDATE tenants
                        SET billing_status='suspended', updated_at=NOW()
                        WHERE id=:tid AND billing_status != 'suspended'
                    """), {"tid": tid})
                summary["suspended"].append({"tenant_id": tid,
                                             "billing_status": bs, "days_left": days_left})
            except Exception as e:
                summary["errors"].append({"tenant_id": tid, "stage": "suspend", "err": str(e)})
            continue

        # 2) Pick today's template
        ntype = _pick_template(bs, days_left)
        if not ntype:
            continue

        # 3) Dedup within same day
        with engine.connect() as c:
            dup = c.execute(text("""
                SELECT 1 FROM billing_notifications
                WHERE tenant_id=:tid AND type=:tp
                  AND DATE(sent_at AT TIME ZONE 'Asia/Bangkok') = CURRENT_DATE
                LIMIT 1
            """), {"tid": tid, "tp": ntype}).first()
        if dup:
            summary["skipped_duplicate"] += 1
            continue

        # 4) Need a line_uid to send
        if not r["line_uid"]:
            summary["skipped_no_line"].append({"tenant_id": tid, "type": ntype})
            continue

        msg = NOTIFY_TEMPLATES[ntype]

        if dry:
            summary["notified"].append({"tenant_id": tid, "type": ntype, "dry": True})
            continue

        try:
            sent = notify_tenant_line(r["line_uid"], msg, token)
            with engine.begin() as c:
                c.execute(text("""
                    INSERT INTO billing_notifications (tenant_id, type, channel)
                    VALUES (:tid, :tp, 'line')
                """), {"tid": tid, "tp": ntype})
            summary["notified"].append({"tenant_id": tid, "type": ntype, "sent": sent})
        except Exception as e:
            summary["errors"].append({"tenant_id": tid, "stage": "notify",
                                      "type": ntype, "err": str(e)})

    return summary


_scheduler = None


def start_scheduler() -> bool:
    """Idempotent — safe to call on every startup."""
    global _scheduler
    if _scheduler is not None:
        return False
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger
        _scheduler = BackgroundScheduler(timezone="Asia/Bangkok")
        _scheduler.add_job(
            check_billing,
            CronTrigger(hour=9, minute=0),
            id="billing_daily_check",
            replace_existing=True,
            misfire_grace_time=3600,
        )
        _scheduler.start()
        return True
    except Exception:
        return False


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        try:
            _scheduler.shutdown(wait=False)
        except Exception:
            pass
        _scheduler = None
