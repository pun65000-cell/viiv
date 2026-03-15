from fastapi import APIRouter, Depends
from app.schemas.users import UserRead
from app.core.auth import get_current_user

router = APIRouter(tags=['users'])

@router.get('/me', response_model=UserRead)
async def me(user=Depends(get_current_user)):
    return UserRead(id=str(user.id), email=user.email, created_at=user.created_at)
