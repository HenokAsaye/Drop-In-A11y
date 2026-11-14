from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Lesson, Transcript


class LessonRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, lesson_id: str) -> Lesson | None:
        """Load a lesson with its captions, transcripts and documents eagerly."""
        stmt = (
            select(Lesson)
            .where(Lesson.id == lesson_id)
            .options(
                selectinload(Lesson.captions),
                selectinload(Lesson.transcripts),
                selectinload(Lesson.documents),
            )
        )
        return (await self._session.scalars(stmt)).one_or_none()

    async def get_transcript(self, lesson_id: str, language: str) -> Transcript | None:
        """Load one language of a lesson, or None when that pair does not exist."""
        stmt = select(Transcript).where(
            Transcript.lesson_id == lesson_id,
            Transcript.language == language,
        )
        return (await self._session.scalars(stmt)).one_or_none()
