import secrets

_ALLOWED = {'usr', 'cus', 'prd', 'ord', 'evt'}

def generate_id(prefix: str) -> str:
    if prefix not in _ALLOWED:
        raise ValueError('invalid prefix')
    return f"{prefix}_{secrets.token_hex(3)}"
