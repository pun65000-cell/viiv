from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from sqlalchemy.orm import Session
from app.core.db import SessionLocal
from app.models.tenant import Tenant
from sqlalchemy import select

class TenantContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path or '/'
        slug = None
        parts = [p for p in path.split('/') if p]
        if parts and parts[0] != 'api':
            slug = parts[0]
        if not slug:
            slug = request.headers.get('X-Shop')
        tenant_id = None
        if slug:
            db: Session = SessionLocal()
            try:
                t = db.execute(select(Tenant).where(Tenant.slug == slug)).scalar_one_or_none()
                if t:
                    tenant_id = getattr(t, 'id', None) or getattr(t, 'tenant_id', None)
            finally:
                db.close()
        request.state.tenant_id = tenant_id
        response: Response = await call_next(request)
        return response
