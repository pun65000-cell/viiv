import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Load /home/viivadmin/viiv/.env when run as standalone uvicorn (no shared parent)
load_dotenv("/home/viivadmin/viiv/.env")

DATABASE_URL = os.environ["DATABASE_URL"].replace("postgresql://", "postgresql+asyncpg://")
engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
