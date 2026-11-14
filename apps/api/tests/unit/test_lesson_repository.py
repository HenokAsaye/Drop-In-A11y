from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.models  # noqa: F401
from app.db.base import Base
from app.repositories.lessons import LessonRepository
from tests.unit.factories import networking_lesson


@pytest.fixture
async def session(tmp_path: Path) -> AsyncIterator[AsyncSession]:
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path}/lessons.db")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


async def test_get_loads_captions_transcripts_and_documents(session: AsyncSession) -> None:
    session.add(networking_lesson())
    await session.commit()

    lesson = await LessonRepository(session).get("networking-101")

    assert lesson is not None
    assert [track.language for track in lesson.captions] == ["en", "am"]
    assert lesson.transcripts[0].segments[0]["text"] == "Welcome to our networking lesson."
    assert lesson.documents[0].title == "Networking Notes"


async def test_get_returns_none_for_unknown_lesson(session: AsyncSession) -> None:
    assert await LessonRepository(session).get("missing-lesson") is None


async def test_children_are_loaded_before_the_session_detaches_them(session: AsyncSession) -> None:
    session.add(networking_lesson())
    await session.commit()
    lesson = await LessonRepository(session).get("networking-101")
    assert lesson is not None
    session.expunge(lesson)

    assert lesson.captions[0].label == "English"
    assert lesson.documents[0].pdf_path == "networking-101-notes.pdf"
