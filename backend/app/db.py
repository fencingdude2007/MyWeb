import ssl
from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


class Base(DeclarativeBase):
    pass


def _normalize(raw: str) -> tuple[str, bool]:
    """Return (asyncpg URL without query params, whether SSL is needed).

    Neon hands you `postgresql://...?sslmode=require&channel_binding=require`.
    asyncpg wants the `postgresql+asyncpg://` scheme and takes SSL via a
    connect arg, not the query string — so we strip the query and flag SSL.
    """
    needs_ssl = "sslmode" in raw or "neon.tech" in raw
    base = raw.split("?", 1)[0]
    for prefix in ("postgresql+asyncpg://", "postgresql://", "postgres://"):
        if base.startswith(prefix):
            base = "postgresql+asyncpg://" + base[len(prefix) :]
            break
    return base, needs_ssl


def connect_args() -> dict[str, Any]:
    _, needs_ssl = _normalize(settings.database_url)
    return {"ssl": ssl.create_default_context()} if needs_ssl else {}


DATABASE_URL, _ = _normalize(settings.database_url)

engine = create_async_engine(DATABASE_URL, connect_args=connect_args(), pool_pre_ping=True)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with async_session() as session:
        yield session
