class TenantRegistry:
    def __init__(self):
        self._tenants_by_id = {}
        self._tenant_id_by_slug = {}

    def register_tenant(self, tenant_id, slug, package):
        record = {"tenant_id": tenant_id, "slug": slug, "package": package}
        existing_id = self._tenant_id_by_slug.get(slug)
        if existing_id is not None and existing_id in self._tenants_by_id:
            del self._tenants_by_id[existing_id]
        self._tenants_by_id[tenant_id] = record
        self._tenant_id_by_slug[slug] = tenant_id
        return record

    def get_tenant_by_slug(self, slug):
        tenant_id = self._tenant_id_by_slug.get(slug)
        if tenant_id is None:
            return None
        return self._tenants_by_id.get(tenant_id)

    def get_tenant(self, tenant_id):
        return self._tenants_by_id.get(tenant_id)

    def list_tenants(self):
        return list(self._tenants_by_id.values())
