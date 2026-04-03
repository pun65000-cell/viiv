from fastapi import APIRouter

router = APIRouter(prefix="/api/stores", tags=["stores"])


@router.get("/")
def get_stores():
    return [
        {
            "id": 1,
            "name": "ร้านตัวอย่าง A",
            "status": "active",
        },
        {
            "id": 2,
            "name": "ร้านตัวอย่าง B",
            "status": "inactive",
        },
    ]

