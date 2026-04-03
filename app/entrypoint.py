from fastapi import FastAPI
from app.modules.auth.api import router as auth_router
from app.modules.internal_owner.owner_internal_endpoint import router as internal_owner_router

app = FastAPI()

app.include_router(auth_router)
app.include_router(internal_owner_router)
