class EventBus:
    def __init__(self):
        self._subscribers = {}

    def subscribe(self, event_name, handler):
        handlers = self._subscribers.setdefault(event_name, [])
        handlers.append(handler)
        return handler

    def publish(self, event_name, payload):
        for handler in list(self._subscribers.get(event_name, [])):
            handler(payload)

    def list_subscribers(self, event_name):
        return list(self._subscribers.get(event_name, []))
