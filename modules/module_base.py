class BaseModule:
    def initialize(self, event_bus):
        pass

    def handle_request(self, tenant_id, payload):
        raise NotImplementedError

    def get_name(self):
        raise NotImplementedError
