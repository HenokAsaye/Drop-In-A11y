from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.models  # noqa: F401
from app.core.config import Settings
from app.db.base import Base
from app.db.session import get_session
from app.main import create_app
from app.models import Lesson, Transcript
from tests.unit.factories import networking_lesson, networking_lesson_json


@asynccontextmanager
async def _lesson_client(tmp_path: Path, lesson: Lesson) -> AsyncIterator[AsyncClient]:
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path}/lessons.db")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        session.add(lesson)
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


@pytest.fixture
async def client(tmp_path: Path) -> AsyncIterator[AsyncClient]:
    async with _lesson_client(tmp_path, networking_lesson()) as client:
        yield client


@pytest.fixture
async def amharic_client(tmp_path: Path) -> AsyncIterator[AsyncClient]:
    lesson = networking_lesson()
    lesson.transcripts.append(
        Transcript(
            language="am",
            label="Amharic",
            segments=[{"start": 0, "end": 2, "text": "እንኳን ደህና መጡ"}],
        )
    )
    async with _lesson_client(tmp_path, lesson) as client:
        yield client


async def test_lesson_returns_stored_chapters(tmp_path: Path) -> None:
    lesson = networking_lesson()
    lesson.chapters = [
        {"name": "Welcome", "start": 0},
        {"name": "How computers connect", "start": 45},
    ]
    async with _lesson_client(tmp_path, lesson) as client:
        response = await client.get("/api/v1/lessons/networking-101")

    assert response.status_code == 200
    assert response.json()["chapters"] == [
        {"name": "Welcome", "start": 0.0},
        {"name": "How computers connect", "start": 45.0},
    ]


async def test_lesson_without_chapters_returns_an_empty_list(client: AsyncClient) -> None:
    response = await client.get("/api/v1/lessons/networking-101")

    assert response.status_code == 200
    assert response.json()["chapters"] == []


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


async def test_offline_package_returns_declared_resources(client: AsyncClient) -> None:
    response = await client.get("/api/v1/lessons/networking-101/offline")

    assert response.status_code == 200
    data = response.json()
    assert data["lessonId"] == "networking-101"
    assert data["version"]
    assert len(data["resources"]) > 0
    for resource in data["resources"]:
        assert resource["url"].startswith("http")


async def test_unknown_lesson_captions_and_documents_are_404(client: AsyncClient) -> None:
    for path in (
        "/api/v1/lessons/missing-lesson/captions",
        "/api/v1/lessons/missing-lesson/documents",
        "/api/v1/lessons/missing-lesson/offline",
    ):
        response = await client.get(path)
        assert response.status_code == 404
        assert response.json()["code"] == "not_found"


async def test_english_transcript_returns_stored_segments(client: AsyncClient) -> None:
    response = await client.get(
        "/api/v1/lessons/networking-101/transcript", params={"language": "en"}
    )

    assert response.status_code == 200
    assert response.json() == {
        "language": "en",
        "segments": [{"start": 0.0, "end": 4.0, "text": "Welcome to our networking lesson."}],
    }


async def test_transcript_defaults_to_english(client: AsyncClient) -> None:
    response = await client.get("/api/v1/lessons/networking-101/transcript")

    assert response.status_code == 200
    assert response.json()["language"] == "en"
    assert response.json()["segments"][0]["text"] == "Welcome to our networking lesson."


async def test_amharic_transcript_returns_segments(amharic_client: AsyncClient) -> None:
    response = await amharic_client.get(
        "/api/v1/lessons/networking-101/transcript", params={"language": "am"}
    )

    assert response.status_code == 200
    assert response.json() == {
        "language": "am",
        "segments": [{"start": 0.0, "end": 2.0, "text": "እንኳን ደህና መጡ"}],
    }


async def test_missing_transcript_language_is_404(client: AsyncClient) -> None:
    response = await client.get(
        "/api/v1/lessons/networking-101/transcript", params={"language": "am"}
    )

    assert response.status_code == 404
    assert response.json() == {
        "detail": "Transcript 'networking-101:am' was not found",
        "code": "not_found",
        "resource": "Transcript",
    }


async def test_transcript_for_unknown_lesson_is_404(client: AsyncClient) -> None:
    response = await client.get("/api/v1/lessons/missing-lesson/transcript")

    assert response.status_code == 404
    assert response.json() == {
        "detail": "Lesson 'missing-lesson' was not found",
        "code": "not_found",
        "resource": "Lesson",
    }
