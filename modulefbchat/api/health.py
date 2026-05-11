from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/health")
async def health(request: Request):
    manager = request.app.state.manager
    return {
        "status": "ok",
        "module": "modulefbchat",
        "version": "0.1.0",
        "pool": manager.stats() if manager else {},
    }
