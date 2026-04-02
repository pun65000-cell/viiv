from datetime import datetime, timedelta
from typing import Dict, Any, Optional

PACKAGES = {
    "TRIAL": {"duration_days": 14, "product_limit": 20, "features": "basic"},
    "BASIC": {"duration_days": 30, "features": "medium"},
    "PRO": {"duration_days": None, "features": "all"},
}

user_packages: Dict[str, Dict[str, Any]] = {}


def get_packages():
    return PACKAGES


def assign_trial(user_id: str):
    now = datetime.utcnow()
    expires_at = now + timedelta(days=PACKAGES["TRIAL"]["duration_days"])
    user_packages[user_id] = {
        "plan": "TRIAL",
        "expires_at": expires_at.isoformat(),
        "assigned_at": now.isoformat(),
    }
    return user_packages[user_id]


def check_expiry(user_id: str) -> Optional[Dict[str, Any]]:
    pkg = user_packages.get(user_id)
    if not pkg:
        return None
    plan = pkg.get("plan")
    if plan == "PRO":
        return {"valid": True, "plan": plan, "expires_at": None}
    exp = pkg.get("expires_at")
    if not exp:
        return {"valid": False, "plan": plan, "expires_at": None}
    try:
        exp_dt = datetime.fromisoformat(exp)
    except Exception:
        return {"valid": False, "plan": plan, "expires_at": exp}
    valid = datetime.utcnow() <= exp_dt
    return {"valid": valid, "plan": plan, "expires_at": exp}


def set_plan(user_id: str, plan: str):
    now = datetime.utcnow()
    if plan == "PRO":
        user_packages[user_id] = {"plan": "PRO", "expires_at": None, "assigned_at": now.isoformat()}
    elif plan in PACKAGES:
        expires_at = now + timedelta(days=PACKAGES[plan]["duration_days"])
        user_packages[user_id] = {"plan": plan, "expires_at": expires_at.isoformat(), "assigned_at": now.isoformat()}
    return user_packages[user_id]


def get_user_package(user_id: str) -> Optional[Dict[str, Any]]:
    return user_packages.get(user_id)


def list_user_packages() -> Dict[str, Dict[str, Any]]:
    return user_packages
