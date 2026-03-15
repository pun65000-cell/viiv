from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.repositories import tenants as tenant_repo

class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path or '/'
        tenant = None
        if not path.startswith('/api'):
            segments = [s for s in path.split('/') if s]
            if segments:
                slug = segments[0]
                db: Session = SessionLocal()
                try:
                    tenant = tenant_repo.get_tenant_by_slug(db, slug)
                finally:
                    db.close()
        request.state.tenant = tenant
        response: Response = await call_next(request)
        return response
