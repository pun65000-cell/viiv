# COMPATIBILITY LAYER — ห้ามลบ
# ไฟล์นี้มีไว้เพื่อให้ import เดิมทำงานได้
# source of truth อยู่ที่ app/core/db.py
# ถ้าจะแก้ DB config ให้แก้ที่ db.py เท่านั้น
from app.core.db import engine, SessionLocal, Base  # re-export for compatibility
