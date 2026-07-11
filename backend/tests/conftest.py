import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.db import async_session, engine
from app.main import app


@pytest_asyncio.fixture
async def client() -> AsyncClient:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture(autouse=True)
async def _cleanup_test_users():
    """Remove test-created users, then dispose the connection pool.

    Disposing after each test avoids reusing an asyncpg connection across
    pytest-asyncio's per-test event loops ("Event loop is closed").
    """
    yield
    async with async_session() as session:
        await session.execute(
            text("DELETE FROM users WHERE email LIKE 'pytest%@example.com'")
        )
        await session.commit()
    await engine.dispose()
