import os, jwt, json
from typing import Optional, List
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
import httpx
from app.core.db import engine

router = APIRouter(prefix="/ai/prompts", tags=["platform-ai-brain"])

JWT_SECRET = os.getenv(
    "JWT_SECRET",
    "21cc8b2ff8e25e6262effb2b47b15c39fb16438525b6d041bb842a130c08be7c"
)

VALID_SLOTS = (
    "chat_bot",
    "complex_post",
    "pos_help",
    "autopost",
    "analytics",
    "internal_ops",
    "fallback",
)

SLOT_META = {
    "chat_bot":     {"label": "Chat/Bot",      "icon": "💬", "desc": "ตอบลูกค้า"},
    "complex_post": {"label": "Complex/Post",  "icon": "📝", "desc": "งานยาว ซับซ้อน"},
    "pos_help":     {"label": "POS Help",      "icon": "💡", "desc": "ช่วยใช้ POS"},
    "autopost":     {"label": "AutoPost",      "icon": "🎨", "desc": "สร้างโพสต์ขาย"},
    "analytics":    {"label": "Analytics",     "icon": "📊", "desc": "วิเคราะห์ data"},
    "internal_ops": {"label": "Internal Ops",  "icon": "🏢", "desc": "VIIV office/support"},
    "fallback":     {"label": "Fallback",      "icon": "🛟", "desc": "เมื่อ primary fail"},
}


# ============================================
# Auth (strict — admin only, distinct from platform_ai._admin_auth)
# ============================================
def _admin_auth(authorization: Optional[str]):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "No token")
    try:
        tok = authorization.replace("Bearer ", "").strip()
        payload = jwt.decode(
            tok, JWT_SECRET, algorithms=["HS256"],
            options={"leeway": 864000, "verify_exp": False}
        )
        if payload.get("is_admin") or payload.get("role") in ("admin", "superadmin"):
            return payload
        raise HTTPException(403, "Admin only")
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(401, "Invalid token")


def _validate_slot(slot: str):
    if slot not in VALID_SLOTS:
        raise HTTPException(400, f"Invalid slot. Must be one of {VALID_SLOTS}")


def _user_id(payload: dict) -> str:
    return payload.get("user_id") or payload.get("sub") or "unknown"


# ============================================
# Models
# ============================================
class PromptSaveBody(BaseModel):
    base_text: Optional[str] = None
    custom_text: Optional[str] = None
    notes: Optional[str] = ""


class PatchCreateBody(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    patch_text: str = Field(..., min_length=1, max_length=2000)
    note: Optional[str] = ""
    priority: int = 100
    is_active: bool = True


class PatchUpdateBody(BaseModel):
    title: Optional[str] = None
    patch_text: Optional[str] = None
    note: Optional[str] = None
    priority: Optional[int] = None


class PreviewBody(BaseModel):
    base_text: Optional[str] = None
    custom_text: Optional[str] = None


class TestBody(BaseModel):
    test_input: str = Field(..., min_length=1, max_length=500)
    shop_id: Optional[str] = None


class RestoreBody(BaseModel):
    notes: Optional[str] = ""


# ============================================
# Composer (shared logic — runtime ก็ใช้ตัวนี้)
# ============================================
def compose_final_prompt(slot: str, base_text: str, custom_text: str,
                         patches: List[dict], shop_id: Optional[str] = None) -> str:
    parts = [base_text or ""]
    if custom_text:
        parts.append("\n=== บริบทเพิ่มเติม ===\n" + custom_text)
    if patches:
        parts.append("\n=== ข้อกำหนด ===")
        for p in patches:
            parts.append(f"- {p['patch_text']}")
    final = "\n".join(parts)
    if shop_id:
        final += f"\n\n[Context] ลูกค้าทักจากร้าน: {shop_id}"
    return final


# ============================================
# GET /roles — list available roles + meta
# ============================================
@router.get("/roles")
def list_roles(authorization: str = Header(None)):
    _admin_auth(authorization)
    return {
        "roles": [
            {
                "slot": s,
                "label": SLOT_META[s]["label"],
                "icon": SLOT_META[s]["icon"],
                "desc": SLOT_META[s]["desc"],
            }
            for s in VALID_SLOTS
        ]
    }


# ============================================
# GET / — list ทั้ง 3 slot
# ============================================
@router.get("")
def list_prompts(authorization: str = Header(None)):
    _admin_auth(authorization)
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT slot, base_text, custom_text, current_version, updated_at, updated_by
            FROM ai_prompts ORDER BY slot
        """)).fetchall()
    return {
        "slots": [
            {
                "slot": r.slot,
                "base_text": r.base_text,
                "custom_text": r.custom_text,
                "current_version": r.current_version,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
                "updated_by": r.updated_by,
            }
            for r in rows
        ]
    }


# ============================================
# GET /{slot} — เฉพาะ slot
# ============================================
@router.get("/{slot}")
def get_prompt(slot: str, authorization: str = Header(None)):
    _admin_auth(authorization)
    _validate_slot(slot)
    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT slot, base_text, custom_text, current_version, updated_at, updated_by
            FROM ai_prompts WHERE slot=:s
        """), {"s": slot}).fetchone()
        if not row:
            raise HTTPException(404, f"Slot {slot} not found")
        patches = conn.execute(text("""
            SELECT id, title, patch_text, is_active, priority, note, created_at, paused_at
            FROM ai_prompt_patches WHERE slot=:s
            ORDER BY is_active DESC, priority ASC, created_at ASC
        """), {"s": slot}).fetchall()
    return {
        "slot": row.slot,
        "base_text": row.base_text,
        "custom_text": row.custom_text,
        "current_version": row.current_version,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "updated_by": row.updated_by,
        "patches": [
            {
                "id": p.id,
                "title": p.title,
                "patch_text": p.patch_text,
                "is_active": p.is_active,
                "priority": p.priority,
                "note": p.note,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "paused_at": p.paused_at.isoformat() if p.paused_at else None,
            }
            for p in patches
        ],
    }


# ============================================
# PUT /{slot} — save (auto snapshot ก่อน update)
# ============================================
@router.put("/{slot}")
def save_prompt(slot: str, body: PromptSaveBody, authorization: str = Header(None)):
    payload = _admin_auth(authorization)
    _validate_slot(slot)

    new_base = body.base_text
    new_custom = body.custom_text

    if new_base is not None and len(new_base) > 10000:
        raise HTTPException(400, "base_text too long (max 10000)")
    if new_custom is not None and len(new_custom) > 10000:
        raise HTTPException(400, "custom_text too long (max 10000)")

    user = _user_id(payload)

    with engine.begin() as conn:
        cur = conn.execute(text("""
            SELECT base_text, custom_text, current_version FROM ai_prompts WHERE slot=:s
        """), {"s": slot}).fetchone()
        if not cur:
            raise HTTPException(404, f"Slot {slot} not found")

        patches_now = conn.execute(text("""
            SELECT id, title, patch_text, is_active, priority, note
            FROM ai_prompt_patches WHERE slot=:s ORDER BY priority, created_at
        """), {"s": slot}).fetchall()
        patches_snap = [
            {
                "id": p.id, "title": p.title, "patch_text": p.patch_text,
                "is_active": p.is_active, "priority": p.priority, "note": p.note,
            }
            for p in patches_now
        ]

        new_version = cur.current_version + 1
        conn.execute(text("""
            INSERT INTO ai_prompt_versions
              (slot, version, base_text, custom_text, patches_snapshot, saved_by, notes)
            VALUES (:s, :v, :b, :c, CAST(:p AS jsonb), :u, :n)
        """), {
            "s": slot, "v": new_version,
            "b": new_base if new_base is not None else cur.base_text,
            "c": new_custom if new_custom is not None else cur.custom_text,
            "p": json.dumps(patches_snap, ensure_ascii=False),
            "u": user,
            "n": body.notes or "",
        })

        sets = ["current_version=:v", "updated_at=now()", "updated_by=:u"]
        params = {"s": slot, "v": new_version, "u": user}
        if new_base is not None:
            sets.append("base_text=:b")
            params["b"] = new_base
        if new_custom is not None:
            sets.append("custom_text=:c")
            params["c"] = new_custom
        conn.execute(text(f"""
            UPDATE ai_prompts SET {', '.join(sets)} WHERE slot=:s
        """), params)

    return {"ok": True, "slot": slot, "version": new_version}


# ============================================
# GET /{slot}/versions — list history
# ============================================
@router.get("/{slot}/versions")
def list_versions(slot: str, limit: int = 50, authorization: str = Header(None)):
    _admin_auth(authorization)
    _validate_slot(slot)
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT id, version, saved_at, saved_by, notes,
                   length(base_text)   AS base_len,
                   length(custom_text) AS custom_len
            FROM ai_prompt_versions
            WHERE slot=:s
            ORDER BY version DESC
            LIMIT :l
        """), {"s": slot, "l": limit}).fetchall()
    return {
        "versions": [
            {
                "id": r.id,
                "version": r.version,
                "saved_at": r.saved_at.isoformat() if r.saved_at else None,
                "saved_by": r.saved_by,
                "notes": r.notes,
                "base_len": r.base_len,
                "custom_len": r.custom_len,
            }
            for r in rows
        ]
    }


# ============================================
# GET /{slot}/versions/{version} — ดู version specific
# ============================================
@router.get("/{slot}/versions/{version}")
def get_version(slot: str, version: int, authorization: str = Header(None)):
    _admin_auth(authorization)
    _validate_slot(slot)
    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT slot, version, base_text, custom_text, patches_snapshot,
                   saved_at, saved_by, notes
            FROM ai_prompt_versions WHERE slot=:s AND version=:v
        """), {"s": slot, "v": version}).fetchone()
    if not row:
        raise HTTPException(404, "Version not found")
    return {
        "slot": row.slot, "version": row.version,
        "base_text": row.base_text, "custom_text": row.custom_text,
        "patches_snapshot": row.patches_snapshot,
        "saved_at": row.saved_at.isoformat() if row.saved_at else None,
        "saved_by": row.saved_by, "notes": row.notes,
    }


# ============================================
# POST /{slot}/restore/{version} — restore version
# ============================================
@router.post("/{slot}/restore/{version}")
def restore_version(slot: str, version: int, body: RestoreBody,
                    authorization: str = Header(None)):
    payload = _admin_auth(authorization)
    _validate_slot(slot)
    user = _user_id(payload)

    with engine.begin() as conn:
        target = conn.execute(text("""
            SELECT base_text, custom_text FROM ai_prompt_versions
            WHERE slot=:s AND version=:v
        """), {"s": slot, "v": version}).fetchone()
        if not target:
            raise HTTPException(404, "Version not found")

        cur = conn.execute(text("""
            SELECT current_version FROM ai_prompts WHERE slot=:s
        """), {"s": slot}).fetchone()
        new_version = cur.current_version + 1

        patches_now = conn.execute(text("""
            SELECT id, title, patch_text, is_active, priority, note
            FROM ai_prompt_patches WHERE slot=:s ORDER BY priority, created_at
        """), {"s": slot}).fetchall()
        patches_snap = [
            {"id": p.id, "title": p.title, "patch_text": p.patch_text,
             "is_active": p.is_active, "priority": p.priority, "note": p.note}
            for p in patches_now
        ]
        conn.execute(text("""
            INSERT INTO ai_prompt_versions
              (slot, version, base_text, custom_text, patches_snapshot, saved_by, notes)
            SELECT slot, :v, base_text, custom_text, CAST(:p AS jsonb), :u, :n
            FROM ai_prompts WHERE slot=:s
        """), {
            "s": slot, "v": new_version,
            "p": json.dumps(patches_snap, ensure_ascii=False),
            "u": user,
            "n": f"Auto-snapshot before restore to v{version}. " + (body.notes or ""),
        })

        conn.execute(text("""
            UPDATE ai_prompts
            SET base_text=:b, custom_text=:c, current_version=:v,
                updated_at=now(), updated_by=:u
            WHERE slot=:s
        """), {
            "s": slot, "b": target.base_text, "c": target.custom_text,
            "v": new_version, "u": user,
        })

    return {"ok": True, "slot": slot, "restored_from": version, "new_version": new_version}


# ============================================
# Patches CRUD
# ============================================
@router.get("/{slot}/patches")
def list_patches(slot: str, authorization: str = Header(None)):
    _admin_auth(authorization)
    _validate_slot(slot)
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT id, title, patch_text, is_active, priority, note,
                   created_at, created_by, paused_at
            FROM ai_prompt_patches WHERE slot=:s
            ORDER BY is_active DESC, priority ASC, created_at ASC
        """), {"s": slot}).fetchall()
    return {
        "patches": [
            {
                "id": r.id, "title": r.title, "patch_text": r.patch_text,
                "is_active": r.is_active, "priority": r.priority, "note": r.note,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "created_by": r.created_by,
                "paused_at": r.paused_at.isoformat() if r.paused_at else None,
            }
            for r in rows
        ]
    }


@router.post("/{slot}/patches")
def create_patch(slot: str, body: PatchCreateBody, authorization: str = Header(None)):
    payload = _admin_auth(authorization)
    _validate_slot(slot)
    user = _user_id(payload)
    with engine.begin() as conn:
        row = conn.execute(text("""
            INSERT INTO ai_prompt_patches
              (slot, title, patch_text, is_active, priority, note, created_by)
            VALUES (:s, :t, :p, :a, :pr, :n, :u)
            RETURNING id
        """), {
            "s": slot, "t": body.title, "p": body.patch_text,
            "a": body.is_active, "pr": body.priority, "n": body.note or "",
            "u": user,
        }).fetchone()
    return {"ok": True, "id": row.id}


@router.put("/patches/{patch_id}")
def update_patch(patch_id: str, body: PatchUpdateBody, authorization: str = Header(None)):
    _admin_auth(authorization)
    sets = []
    params = {"id": patch_id}
    if body.title is not None:
        sets.append("title=:t"); params["t"] = body.title
    if body.patch_text is not None:
        if len(body.patch_text) > 2000:
            raise HTTPException(400, "patch_text too long (max 2000)")
        sets.append("patch_text=:p"); params["p"] = body.patch_text
    if body.note is not None:
        sets.append("note=:n"); params["n"] = body.note
    if body.priority is not None:
        sets.append("priority=:pr"); params["pr"] = body.priority
    if not sets:
        raise HTTPException(400, "No fields to update")
    with engine.begin() as conn:
        result = conn.execute(text(f"""
            UPDATE ai_prompt_patches SET {', '.join(sets)} WHERE id=:id
        """), params)
        if result.rowcount == 0:
            raise HTTPException(404, "Patch not found")
    return {"ok": True}


@router.patch("/patches/{patch_id}/toggle")
def toggle_patch(patch_id: str, authorization: str = Header(None)):
    _admin_auth(authorization)
    with engine.begin() as conn:
        row = conn.execute(text("""
            SELECT is_active FROM ai_prompt_patches WHERE id=:id
        """), {"id": patch_id}).fetchone()
        if not row:
            raise HTTPException(404, "Patch not found")
        new_state = not row.is_active
        conn.execute(text("""
            UPDATE ai_prompt_patches
            SET is_active=:a,
                paused_at = CASE WHEN :a=false THEN now() ELSE NULL END
            WHERE id=:id
        """), {"a": new_state, "id": patch_id})
    return {"ok": True, "is_active": new_state}


@router.delete("/patches/{patch_id}")
def delete_patch(patch_id: str, authorization: str = Header(None)):
    _admin_auth(authorization)
    with engine.begin() as conn:
        result = conn.execute(text("""
            DELETE FROM ai_prompt_patches WHERE id=:id
        """), {"id": patch_id})
        if result.rowcount == 0:
            raise HTTPException(404, "Patch not found")
    return {"ok": True}


# ============================================
# POST /{slot}/preview — compose final prompt (no save)
# ============================================
@router.post("/{slot}/preview")
def preview_prompt(slot: str, body: PreviewBody, authorization: str = Header(None)):
    _admin_auth(authorization)
    _validate_slot(slot)
    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT base_text, custom_text FROM ai_prompts WHERE slot=:s
        """), {"s": slot}).fetchone()
        patches = conn.execute(text("""
            SELECT title, patch_text FROM ai_prompt_patches
            WHERE slot=:s AND is_active=true
            ORDER BY priority ASC, created_at ASC
        """), {"s": slot}).fetchall()

    base = body.base_text if body.base_text is not None else (row.base_text if row else "")
    custom = body.custom_text if body.custom_text is not None else (row.custom_text if row else "")
    patches_list = [{"patch_text": p.patch_text} for p in patches]

    final = compose_final_prompt(slot, base, custom, patches_list)
    return {
        "final_prompt": final,
        "char_count": len(final),
        "estimated_tokens": len(final) // 3,
    }


# ============================================
# POST /{slot}/test — run sandbox via moduleai
# ============================================
@router.post("/{slot}/test")
def test_prompt(slot: str, body: TestBody, authorization: str = Header(None)):
    payload = _admin_auth(authorization)
    _validate_slot(slot)
    user = _user_id(payload)

    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT base_text, custom_text FROM ai_prompts WHERE slot=:s
        """), {"s": slot}).fetchone()
        patches = conn.execute(text("""
            SELECT patch_text FROM ai_prompt_patches
            WHERE slot=:s AND is_active=true
            ORDER BY priority ASC, created_at ASC
        """), {"s": slot}).fetchall()

    if not row:
        raise HTTPException(404, f"Slot {slot} not found")

    patches_list = [{"patch_text": p.patch_text} for p in patches]
    final_prompt = compose_final_prompt(
        slot, row.base_text, row.custom_text, patches_list, body.shop_id
    )

    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.post(
                "http://localhost:8002/chat",
                json={
                    "messages": [
                        {"role": "system", "content": final_prompt},
                        {"role": "user", "content": body.test_input},
                    ],
                    "tenant_id": body.shop_id or "test_sandbox",
                    "source": "prompt_test",
                },
            )
        if r.status_code != 200:
            raise HTTPException(502, f"moduleai returned {r.status_code}: {r.text[:200]}")
        ai_data = r.json()
    except httpx.RequestError as e:
        raise HTTPException(502, f"moduleai unreachable: {type(e).__name__}")

    reply = ai_data.get("reply") or ai_data.get("content") or ai_data.get("text") or ""
    tokens_in = ai_data.get("tokens_in") or ai_data.get("input_tokens") or 0
    tokens_out = ai_data.get("tokens_out") or ai_data.get("output_tokens") or 0
    cost = ai_data.get("cost_usd") or 0

    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO ai_prompt_test_log
              (slot, test_input, ai_reply, shop_id, prompt_used,
               tokens_in, tokens_out, cost_usd, tested_by)
            VALUES (:s, :ti, :ar, :sh, :pu, :tin, :tout, :c, :u)
        """), {
            "s": slot, "ti": body.test_input, "ar": reply,
            "sh": body.shop_id, "pu": final_prompt,
            "tin": tokens_in, "tout": tokens_out, "c": cost, "u": user,
        })

    return {
        "ok": True,
        "reply": reply,
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
        "cost_usd": cost,
        "prompt_used_chars": len(final_prompt),
    }
