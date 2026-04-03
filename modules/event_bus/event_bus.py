import time
from contextvars import ContextVar


subscribers = {}

_req_id_ctx = ContextVar("req_id", default=None)


def set_req_id(req_id):
    _req_id_ctx.set(req_id)


def clear_req_id():
    _req_id_ctx.set(None)


def subscribe(event_name, handler):
    if event_name not in subscribers:
        subscribers[event_name] = []
    subscribers[event_name].append(handler)


def emit(event_name, payload):
    req_id = _req_id_ctx.get()
    enriched = dict(payload or {})
    enriched.setdefault("ts", int(time.time()))
    if req_id:
        enriched.setdefault("req_id", req_id)

    handlers = subscribers.get(event_name, [])
    for h in handlers:
        try:
            h(enriched)
        except Exception as e:
            print("EVENT_HANDLER_ERROR", e)


from modules.event_bus.handlers import log_event

subscribe("create_product", log_event)
subscribe("create_order", log_event)
subscribe("adjust_stock", log_event)
subscribe("create_shop", log_event)
subscribe("create_staff", log_event)
subscribe("product_click", log_event)
subscribe("affiliate_conversion", log_event)
