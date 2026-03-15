class ModuleRegistry:
    def __init__(self):
        self._modules = {}
        self._tenant_modules = {}

    def register_module(self, module_name):
        self._modules[module_name] = True
        return module_name

    def enable_module(self, tenant_id, module_name):
        if module_name not in self._modules:
            self.register_module(module_name)
        enabled = self._tenant_modules.setdefault(tenant_id, set())
        enabled.add(module_name)

    def disable_module(self, tenant_id, module_name):
        enabled = self._tenant_modules.get(tenant_id)
        if not enabled:
            return
        enabled.discard(module_name)
        if not enabled:
            del self._tenant_modules[tenant_id]

    def get_modules_for_tenant(self, tenant_id):
        return sorted(self._tenant_modules.get(tenant_id, set()))

    def list_modules(self):
        return sorted(self._modules.keys())
