# modulechat/inbox.py — Phase 1 stub
# In-memory inbox; will become a DB-backed view in Phase 2.


class Inbox:
    def __init__(self) -> None:
        self._items: list = []

    def get_all(self) -> list:
        return list(self._items)

    def add(self, msg: dict) -> None:
        print("INBOX add:", msg)
        self._items.append(msg)
