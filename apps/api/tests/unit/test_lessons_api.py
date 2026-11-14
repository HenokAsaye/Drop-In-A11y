from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.models  # noqa: F401
from app.core.config import Settings
from app.db.base import Base
from app.db.session import get_session
from app.main import create_app
from tests.unit.factories import networking_lesson, networking_lesson_json


@pytest.fixture
async def client(tmp_path: Path) -> AsyncIterator[AsyncClient]:
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path}/lessons.db")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        session.add(networking_lesson())
        await session.commit()

    app = create_app(
        Settings(
            environment="test",
            media_base_url="https://media.example.com",
            public_api_url="https://api.example.com",
            cors_origins=["https://host.example"],
        )
    )

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    await engine.dispose()


async def test_get_lesson_returns_documented_shape(client: AsyncClient) -> None:
    response = await client.get("/api/v1/lessons/networking-101")

    assert response.status_code == 200
    assert response.json() == networking_lesson_json()


async def test_unknown_lesson_is_404(client: AsyncClient) -> None:
    response = await client.get("/api/v1/lessons/missing-lesson")

    assert response.status_code == 404
    assert response.json() == {
        "detail": "Lesson 'missing-lesson' was not found",
        "code": "not_found",
        "resource": "Lesson",
    }


async def test_captions_are_absolute_urls(client: AsyncClient) -> None:
    response = await client.get("/api/v1/lessons/networking-101/captions")

    assert response.status_code == 200
    assert response.json() == networking_lesson_json()["captions"]


async def test_documents_are_absolute_urls(client: AsyncClient) -> None:
    response = await client.get("/api/v1/lessons/networking-101/documents")

    assert response.status_code == 200
    assert response.json() == networking_lesson_json()["documents"]


async def test_unknown_lesson_captions_and_documents_are_404(client: AsyncClient) -> None:
    for path in (
        "/api/v1/lessons/missing-lesson/captions",
        "/api/v1/lessons/missing-lesson/documents",
    ):
        response = await client.get(path)
        assert response.status_code == 404
        assert response.json()["code"] == "not_found"
