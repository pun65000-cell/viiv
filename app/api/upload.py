import os
from fastapi import APIRouter, File, UploadFile
from PIL import Image
from app.core.id import gen_id


router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("/image")
async def upload_image(file: UploadFile = File(...)):
    uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads"))
    os.makedirs(uploads_dir, exist_ok=True)

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
        ext = ".jpg"

    image = Image.open(file.file)
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGB")

    max_size = 800
    w, h = image.size
    scale = min(max_size / float(max(w, h)), 1.0)
    if scale < 1.0:
        image = image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    filename = f"{gen_id('img')}{ext}"
    out_path = os.path.join(uploads_dir, filename)

    if ext in [".png", ".webp"] and image.mode == "RGBA":
        image.save(out_path)
    else:
        if image.mode != "RGB":
            image = image.convert("RGB")
        image.save(out_path, quality=85, optimize=True)

    return {"image_url": f"/api/uploads/{filename}"}
