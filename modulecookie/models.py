"""Pydantic models for modulecookie API."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class StartSessionRequest(BaseModel):
    tenant_id: str = Field(..., min_length=1, max_length=64)


class SessionInfo(BaseModel):
    session_id: str
    tenant_id: str
    started_at: datetime
    expires_at: datetime


class StartSessionResponse(BaseModel):
    session_id: str
    url: str
    expires_at: datetime


class SessionStatusResponse(BaseModel):
    alive: bool
    session_id: Optional[str] = None
    tenant_id: Optional[str] = None
    age_seconds: Optional[int] = None


class DestroyResponse(BaseModel):
    status: str
    session_id: str
