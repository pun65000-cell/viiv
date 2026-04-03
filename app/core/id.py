import random
import string
import time


def gen_id(prefix: str):
    ts = int(time.time())
    rand = "".join(random.choices(string.ascii_lowercase + string.digits, k=4))
    return f"{prefix}_{ts}_{rand}"

