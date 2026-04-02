from fastapi import APIRouter, Body
from app.domain_services.auth_service import login

router = APIRouter(prefix="/auth")


@router.post("/login")
def login_api(payload: dict = Body(...)):
    email = payload.get("email")
    password = payload.get("password")

    return login(email, password)
