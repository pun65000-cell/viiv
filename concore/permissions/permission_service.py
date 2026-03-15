from concore.permissions.permission_model import Role, DEFAULT_ROLE_FLAGS

def check_permission(role: Role, flag: str) -> bool:
    allowed = DEFAULT_ROLE_FLAGS.get(role, set())
    return flag in allowed
