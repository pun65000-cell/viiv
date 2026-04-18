from app.core.id import gen_id

_ALLOWED = {"usr", "cus", "prd", "ord", "evt", "shp", "stf", "crt", "req", "bill", "vlog", "slog", "clk", "aff", "mem"}

def generate_id(prefix: str) -> str:
    if prefix not in _ALLOWED:
        raise ValueError('invalid prefix')
    return gen_id(prefix)
