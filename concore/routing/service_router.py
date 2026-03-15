class ServiceRouter:
    def __init__(self, tenant_registry, module_registry):
        self.tenants = tenant_registry
        self.modules = module_registry

    def resolve_tenant(self, slug):
        return self.tenants.get_tenant_by_slug(slug)

    def resolve_module(self, tenant_id, module_name):
        enabled = self.modules.get_modules_for_tenant(tenant_id)
        if module_name not in enabled:
            raise ValueError("module not enabled for tenant")
        return module_name

    def route(self, slug, module_name):
        tenant = self.resolve_tenant(slug)
        if not tenant:
            raise ValueError("tenant not found")
        resolved_module = self.resolve_module(tenant["tenant_id"], module_name)
        return {"tenant_id": tenant["tenant_id"], "module": resolved_module}
