from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.models  # noqa: F401
from app.db.base import Base
from app.models import CaptionTrack, Career, Certificate, Lesson, LessonDocument, Transcript
from app.repositories.certificates import CertificateRepository
from app.services.certificates import CertificateService
from scripts.seed import CERTIFICATE_ID, LESSON_ID, seed


@pytest.fixture
async def session(tmp_path: Path) -> AsyncIterator[AsyncSession]:
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path}/seed.db")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


async def _count(session: AsyncSession, model: type) -> int:
    total = await session.scalar(select(func.count()).select_from(model))
    return int(total or 0)


async def test_seed_twice_does_not_duplicate_rows(session: AsyncSession) -> None:
    await seed(session)
    await session.commit()
    await seed(session)
    await session.commit()

    assert await _count(session, Lesson) == 1
    assert await _count(session, CaptionTrack) == 2
    assert await _count(session, Transcript) == 2
    assert await _count(session, LessonDocument) == 1
    assert await _count(session, Certificate) == 1
    assert await _count(session, Career) == 1

    lesson = await session.get(Lesson, LESSON_ID)
    certificate = await session.get(Certificate, CERTIFICATE_ID)
    career = await session.scalar(select(Career).where(Career.certificate_id == CERTIFICATE_ID))
    amharic = await session.scalar(
        select(Transcript).where(Transcript.lesson_id == LESSON_ID, Transcript.language == "am")
    )

    assert lesson is not None
    assert lesson.video_path == "videos/networking-101.mp4"
    assert lesson.poster_path == "videos/networking-101-poster.jpg"
    assert lesson.chapters == [
        {"name": "Welcome", "start": 0},
        {"name": "How computers connect", "start": 45},
        {"name": "Addresses on a network", "start": 90},
    ]
    assert certificate is not None
    assert career is not None
    assert career.certificate_id == certificate.id
    assert certificate.lesson_id == LESSON_ID
    assert certificate.revoked_at is None
    assert amharic is not None
    assert amharic.segments[0]["text"] == "እንኳን ወደ ኔትወርክ ትምህርታችን በደህና መጡ።"

    verified = await CertificateService(CertificateRepository(session)).verify(CERTIFICATE_ID)
    assert verified.valid is True
    assert verified.status == "valid"
