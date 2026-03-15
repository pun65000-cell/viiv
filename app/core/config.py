from __future__ import annotations
import os
from pathlib import Path
from typing import Optional
from pydantic import BaseModel, Field
from dotenv import load_dotenv

class Settings(BaseModel):
    database_url: str
    app_env: str = Field(default='dev')
    jwt_secret: str = Field(default='dev-secret')
    access_token_ttl_minutes: int = Field(default=60)

_DEF_DB = 'postgresql://postgres:postgres@localhost:5432/postgres'

_DEF_ENV = f"""# Application defaults for local development
# Copy to .env for local overrides
DATABASE_URL={_DEF_DB}
JWT_SECRET=change-me
ACCESS_TOKEN_EXPIRE_MINUTES=60
APP_ENV=dev
"""

def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _ensure_env_files(root: Path) -> None:
    example = root / '.env.example'
    if not example.exists():
        example.write_text(_DEF_ENV)
    env = root / '.env'
    if not env.exists():
        env.write_text(_DEF_ENV)


def load_settings() -> Settings:
    root = _project_root()
    _ensure_env_files(root)
    load_dotenv(dotenv_path=root / '.env', override=False)
    # Read envs with fallbacks
    database_url = os.getenv('DATABASE_URL') or _DEF_DB
    app_env = os.getenv('APP_ENV') or 'dev'
    jwt_secret = os.getenv('JWT_SECRET') or os.getenv('SECRET_KEY') or 'dev-secret'
    access_str = os.getenv('ACCESS_TOKEN_EXPIRE_MINUTES') or '60'
    try:
        access_int = int(access_str)
    except Exception:
        access_int = 60
    return Settings(
        database_url=database_url,
        app_env=app_env,
        jwt_secret=jwt_secret,
        access_token_ttl_minutes=access_int,
    )
