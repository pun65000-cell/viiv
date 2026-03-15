from enum import Enum
from dataclasses import dataclass

class Role(str, Enum):
    OWNER = "OWNER"
    MANAGER = "MANAGER"
    STAFF = "STAFF"

ALL_FLAGS = {
    "orders.view",
    "orders.create",
    "products.manage",
    "customers.view",
    "pos.use",
    "reports.view",
}

DEFAULT_ROLE_FLAGS = {
    Role.OWNER: ALL_FLAGS,
    Role.MANAGER: {"orders.view", "orders.create", "products.manage", "customers.view", "pos.use", "reports.view"},
    Role.STAFF: {"orders.view", "orders.create", "pos.use"},
}
