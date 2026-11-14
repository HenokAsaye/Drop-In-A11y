"""Insert the networking-101 demonstration lesson. Safe to run more than once."""

import asyncio
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.models import CaptionTrack, Career, Certificate, Lesson, LessonDocument, Transcript

LESSON_ID = "networking-101"
CERTIFICATE_ID = "networking-101-cert"

_CAPTIONS = (
    ("en", "English", "captions/networking-101-en.vtt"),
    ("am", "Amharic", "captions/networking-101-am.vtt"),
)
_TRANSCRIPTS = (
    ("en", "English", [{"start": 0, "end": 4, "text": "Welcome to our networking lesson."}]),
    (
        "am",
        "Amharic",
        [{"start": 0, "end": 4, "text": "እንኳን ወደ ኔትወርክ ትምህርታችን በደህና መጡ።"}],
    ),
)


async def seed(session: AsyncSession) -> None:
    """Insert missing demonstration rows. Existing rows are left unchanged."""
    if await session.get(Lesson, LESSON_ID) is None:
        session.add(
            Lesson(
                id=LESSON_ID,
                title="Introduction to Computer Networking",
                description="Learn the fundamentals of computer networking.",
                language="en",
                video_path="videos/networking-101.mp4",
                audio_path="audio/networking-101.mp3",
                sign_language_path="sign-language/networking-101-ethsl.mp4",
                audio_description_path="audio-description/networking-101-description.mp3",
                poster_path="videos/networking-101-poster.jpg",
            )
        )
        await session.flush()

    for language, label, path in _CAPTIONS:
        stmt = select(CaptionTrack.id).where(
            CaptionTrack.lesson_id == LESSON_ID,
            CaptionTrack.language == language,
        )
        if await session.scalar(stmt) is None:
            session.add(
                CaptionTrack(lesson_id=LESSON_ID, language=language, label=label, path=path)
            )

    for language, label, segments in _TRANSCRIPTS:
        stmt = select(Transcript.id).where(
            Transcript.lesson_id == LESSON_ID,
            Transcript.language == language,
        )
        if await session.scalar(stmt) is None:
            session.add(
                Transcript(
                    lesson_id=LESSON_ID,
                    language=language,
                    label=label,
                    segments=segments,
                )
            )

    document = select(LessonDocument.id).where(
        LessonDocument.lesson_id == LESSON_ID,
        LessonDocument.title == "Networking Notes",
    )
    if await session.scalar(document) is None:
        session.add(
            LessonDocument(
                lesson_id=LESSON_ID,
                title="Networking Notes",
                language="en",
                html_path="documents/networking-101-notes.html",
                pdf_path="documents/networking-101-notes.pdf",
                position=0,
            )
        )

    if await session.get(Certificate, CERTIFICATE_ID) is None:
        session.add(
            Certificate(
                id=CERTIFICATE_ID,
                holder_name="Demo Learner",
                course_title="Introduction to Computer Networking",
                issuer="Savanna BridgePlayer",
                issued_at=datetime(2026, 1, 15, tzinfo=UTC),
                lesson_id=LESSON_ID,
            )
        )
        await session.flush()

    career = select(Career.id).where(Career.certificate_id == CERTIFICATE_ID)
    if await session.scalar(career) is None:
        session.add(
            Career(
                title="Network Support Technician",
                organization="Savanna Learning",
                description=(
                    "Entry-level network support role for graduates of the networking lesson."
                ),
                location="Addis Ababa",
                application_url="https://example.com/jobs/network-support-technician",
                audio_summary_path="audio/networking-101-career-summary.mp3",
                accommodations=(
                    "Interviews can be conducted with sign language interpretation or extra time."
                ),
                certificate_id=CERTIFICATE_ID,
            )
        )


async def main() -> None:
    engine = create_async_engine(get_settings().database_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with factory() as session:
            await seed(session)
            await session.commit()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
