"""Pool Manager — decision engine for slot allocation/eviction.

Phase C.3 scope: pure logic + DB ops, no background tasks, no mautrix.
All state transitions logged to pool_audit_log.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from .scorer import update_tenant_score

logger = logging.getLogger("modulepool.manager")


class PoolManagerError(Exception):
    pass


class NoSlotAvailable(PoolManagerError):
    """All slots taken and no candidate for eviction."""


# ──────────────────────────────────────────────────────────────────
# Audit helper
# ──────────────────────────────────────────────────────────────────

async def _audit(
    conn,
    platform: str,
    action: str,
    slot_id: Optional[int] = None,
    tenant_id: Optional[str] = None,
    reason: Optional[str] = None,
    detail: Optional[dict] = None,
):
    await conn.execute(
        """INSERT INTO pool_audit_log
               (platform, slot_id, tenant_id, action, reason, detail)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb)""",
        platform, slot_id, tenant_id, action, reason,
        json.dumps(detail or {}),
    )


# ──────────────────────────────────────────────────────────────────
# State transition primitives
# ──────────────────────────────────────────────────────────────────

async def warm_slot(
    pool, slot_id: int, tenant_id: str, worker_pid: Optional[int] = None
) -> dict:
    """empty → warming → active.

    Phase C.3: no mautrix integration, DB only.
    Phase D will add decrypt-cookies + bridge init between warming and active.
    """
    async with pool.acquire() as conn:
        async with conn.transaction():
            slot = await conn.fetchrow(
                "SELECT id, platform, state FROM pool_slots WHERE id = $1 FOR UPDATE",
                slot_id,
            )
            if not slot:
                raise PoolManagerError(f"slot {slot_id} not found")
            if slot["state"] != "empty":
                raise PoolManagerError(
                    f"slot {slot_id} not empty (state={slot['state']})"
                )

            now = datetime.now(timezone.utc)

            # empty → warming
            await conn.execute(
                """UPDATE pool_slots SET
                       state = 'warming',
                       current_tenant_id = $1,
                       assigned_at = $2,
                       last_activity_at = $2,
                       worker_pid = $3,
                       updated_at = $2
                   WHERE id = $4""",
                tenant_id, now, worker_pid, slot_id,
            )
            await _audit(conn, slot["platform"], "warm",
                         slot_id=slot_id, tenant_id=tenant_id,
                         reason="empty→warming")

            # warming → active (Phase D will add real init between these)
            await conn.execute(
                "UPDATE pool_slots SET state = 'active', updated_at = now() WHERE id = $1",
                slot_id,
            )
            await _audit(conn, slot["platform"], "warm",
                         slot_id=slot_id, tenant_id=tenant_id,
                         reason="warming→active")

            return {
                "slot_id": slot_id,
                "platform": slot["platform"],
                "tenant_id": tenant_id,
                "state": "active",
            }


async def cool_slot(pool, slot_id: int, reason: str = "idle") -> dict:
    """active → cooling."""
    async with pool.acquire() as conn:
        async with conn.transaction():
            slot = await conn.fetchrow(
                "SELECT id, platform, state, current_tenant_id "
                "FROM pool_slots WHERE id = $1 FOR UPDATE",
                slot_id,
            )
            if not slot:
                raise PoolManagerError(f"slot {slot_id} not found")
            if slot["state"] not in ("active", "warming"):
                raise PoolManagerError(
                    f"slot {slot_id} cannot cool (state={slot['state']})"
                )

            await conn.execute(
                "UPDATE pool_slots SET state = 'cooling', updated_at = now() WHERE id = $1",
                slot_id,
            )
            await _audit(conn, slot["platform"], "cool",
                         slot_id=slot_id, tenant_id=slot["current_tenant_id"],
                         reason=reason)

            return {
                "slot_id": slot_id,
                "state": "cooling",
                "tenant_id": slot["current_tenant_id"],
            }


async def reheat_slot(pool, slot_id: int) -> dict:
    """cooling → active."""
    async with pool.acquire() as conn:
        async with conn.transaction():
            slot = await conn.fetchrow(
                "SELECT id, platform, state, current_tenant_id "
                "FROM pool_slots WHERE id = $1 FOR UPDATE",
                slot_id,
            )
            if not slot or slot["state"] != "cooling":
                state = slot["state"] if slot else "not found"
                raise PoolManagerError(
                    f"slot {slot_id} not in cooling state (is {state})"
                )

            await conn.execute(
                """UPDATE pool_slots SET
                       state = 'active',
                       last_activity_at = now(),
                       updated_at = now()
                   WHERE id = $1""",
                slot_id,
            )
            await _audit(conn, slot["platform"], "reheat",
                         slot_id=slot_id, tenant_id=slot["current_tenant_id"])

            return {"slot_id": slot_id, "state": "active",
                    "tenant_id": slot["current_tenant_id"]}


async def evict_slot(pool, slot_id: int, reason: str = "manual") -> dict:
    """(cooling|active|dead) → evicting → empty.

    Phase C.3: no mautrix logout, DB only.
    Phase D will add real cleanup (mautrix logout, save since_token).
    """
    async with pool.acquire() as conn:
        async with conn.transaction():
            slot = await conn.fetchrow(
                "SELECT id, platform, state, current_tenant_id "
                "FROM pool_slots WHERE id = $1 FOR UPDATE",
                slot_id,
            )
            if not slot:
                raise PoolManagerError(f"slot {slot_id} not found")

            tenant_id = slot["current_tenant_id"]

            await conn.execute(
                "UPDATE pool_slots SET state = 'evicting', updated_at = now() WHERE id = $1",
                slot_id,
            )
            await _audit(conn, slot["platform"], "evict",
                         slot_id=slot_id, tenant_id=tenant_id,
                         reason=f"start: {reason}")

            await conn.execute(
                """UPDATE pool_slots SET
                       state = 'empty',
                       current_tenant_id = NULL,
                       assigned_at = NULL,
                       last_activity_at = NULL,
                       worker_pid = NULL,
                       updated_at = now()
                   WHERE id = $1""",
                slot_id,
            )
            await _audit(conn, slot["platform"], "evict",
                         slot_id=slot_id, tenant_id=tenant_id,
                         reason=f"done: {reason}")

            return {
                "slot_id": slot_id,
                "evicted_tenant": tenant_id,
                "state": "empty",
            }


async def mark_dead(pool, slot_id: int, reason: str = "health_fail") -> dict:
    """Mark slot dead (health check failed)."""
    async with pool.acquire() as conn:
        async with conn.transaction():
            slot = await conn.fetchrow(
                "SELECT id, platform, current_tenant_id FROM pool_slots "
                "WHERE id = $1 FOR UPDATE",
                slot_id,
            )
            if not slot:
                raise PoolManagerError(f"slot {slot_id} not found")

            await conn.execute(
                "UPDATE pool_slots SET state = 'dead', updated_at = now() WHERE id = $1",
                slot_id,
            )
            await _audit(conn, slot["platform"], "fail",
                         slot_id=slot_id, tenant_id=slot["current_tenant_id"],
                         reason=reason)

            return {"slot_id": slot_id, "state": "dead"}


# ──────────────────────────────────────────────────────────────────
# Heartbeat
# ──────────────────────────────────────────────────────────────────

async def heartbeat(pool, slot_id: int) -> dict:
    """Touch last_activity_at — called by worker on every inbound/outbound."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """UPDATE pool_slots SET last_activity_at = now(), updated_at = now()
               WHERE id = $1 AND state IN ('active', 'cooling')
               RETURNING current_tenant_id, state""",
            slot_id,
        )
        if not row:
            raise PoolManagerError(f"slot {slot_id} not active/cooling")

        return {
            "slot_id": slot_id,
            "tenant_id": row["current_tenant_id"],
            "state": row["state"],
            "reheated": False,
        }


# ──────────────────────────────────────────────────────────────────
# Main decision: request_session
# ──────────────────────────────────────────────────────────────────

async def request_session(pool, tenant_id: str, platform: str) -> dict:
    """Allocate slot for tenant per Phase B section 4.1.

    Priority order:
      1. existing active slot → touch + return
      2. existing cooling slot → reheat
      3. empty slot available → warm
      4. evict lowest-score cooling slot (if score < requester)
      4b. evict lowest-score active slot (if score < requester)
      5. pool full, no evictable → enqueue
    """
    requester_score = await update_tenant_score(pool, tenant_id, platform)

    async with pool.acquire() as conn:
        # Step 1: existing active
        row = await conn.fetchrow(
            """SELECT id FROM pool_slots
               WHERE platform = $1 AND current_tenant_id = $2 AND state = 'active'""",
            platform, tenant_id,
        )
        if row:
            await conn.execute(
                "UPDATE pool_slots SET last_activity_at = now(), updated_at = now() WHERE id = $1",
                row["id"],
            )
            return {"slot_id": row["id"], "outcome": "existing_active",
                    "score": requester_score}

        # Step 2: existing cooling
        row = await conn.fetchrow(
            """SELECT id FROM pool_slots
               WHERE platform = $1 AND current_tenant_id = $2 AND state = 'cooling'""",
            platform, tenant_id,
        )
        if row:
            await reheat_slot(pool, row["id"])
            return {"slot_id": row["id"], "outcome": "reheated",
                    "score": requester_score}

        # Step 3: empty slot
        row = await conn.fetchrow(
            """SELECT id FROM pool_slots
               WHERE platform = $1 AND state = 'empty'
               ORDER BY slot_index ASC LIMIT 1""",
            platform,
        )
        if row:
            result = await warm_slot(pool, row["id"], tenant_id)
            return {"slot_id": row["id"], "outcome": "warmed_empty",
                    "score": requester_score, "detail": result}

        # Step 4: evict lowest-score cooling slot
        row = await conn.fetchrow(
            """SELECT s.id AS slot_id, s.current_tenant_id,
                      COALESCE(a.current_score, 0) AS victim_score
               FROM pool_slots s
               LEFT JOIN tenant_activity a
                   ON a.tenant_id = s.current_tenant_id AND a.platform = $1
               WHERE s.platform = $1 AND s.state = 'cooling'
               ORDER BY COALESCE(a.current_score, 0) ASC, s.last_activity_at ASC
               LIMIT 1""",
            platform,
        )
        if row and row["victim_score"] < requester_score:
            victim = row["current_tenant_id"]
            await evict_slot(pool, row["slot_id"],
                             reason=f"evicted_by={tenant_id} req={requester_score} victim={row['victim_score']}")
            warm_result = await warm_slot(pool, row["slot_id"], tenant_id)
            return {"slot_id": row["slot_id"], "outcome": "evicted_cooling",
                    "victim": victim, "score": requester_score}

        # Step 4b: evict lowest-score active slot
        row = await conn.fetchrow(
            """SELECT s.id AS slot_id, s.current_tenant_id,
                      COALESCE(a.current_score, 0) AS victim_score
               FROM pool_slots s
               LEFT JOIN tenant_activity a
                   ON a.tenant_id = s.current_tenant_id AND a.platform = $1
               WHERE s.platform = $1 AND s.state = 'active'
               ORDER BY COALESCE(a.current_score, 0) ASC, s.last_activity_at ASC
               LIMIT 1""",
            platform,
        )
        if row and row["victim_score"] < requester_score:
            victim = row["current_tenant_id"]
            await evict_slot(pool, row["slot_id"],
                             reason=f"evicted_active_by={tenant_id} req={requester_score} victim={row['victim_score']}")
            warm_result = await warm_slot(pool, row["slot_id"], tenant_id)
            return {"slot_id": row["slot_id"], "outcome": "evicted_active",
                    "victim": victim, "score": requester_score}

        # Step 5: pool full, enqueue
        await conn.execute(
            """INSERT INTO pool_request_queue
                   (tenant_id, platform, priority, reason, status)
               VALUES ($1, $2, $3, $4, 'waiting')
               ON CONFLICT (tenant_id, platform, status) DO NOTHING""",
            tenant_id, platform, requester_score, "pool_full_no_evictable",
        )
        await _audit(conn, platform, "queue_add",
                     tenant_id=tenant_id,
                     reason=f"score={requester_score} pool_full")

        return {"slot_id": None, "outcome": "queued", "score": requester_score}
