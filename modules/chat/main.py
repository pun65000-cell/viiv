from fastapi import FastAPI
from .line_webhook import router as line_router
from .chat_api import router as api_router

app = FastAPI(title="VIIV Chat Module", version="1.0.0")
app.include_router(line_router, prefix="/chat")
app.include_router(api_router, prefix="/chat")

@app.get("/health")
async def health():
    return {"status": "ok", "module": "chat"}
