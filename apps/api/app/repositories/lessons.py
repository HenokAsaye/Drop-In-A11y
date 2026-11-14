from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Lesson, Transcript


class LessonRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, lesson_id: str) -> Lesson | None:
        """Load a lesson with its captions, transcripts and documents eagerly."""
        raise NotImplementedError("LessonRepository.get")

    async def get_transcript(self, lesson_id: str, language: str) -> Transcript | None:
        raise NotImplementedError("LessonRepository.get_transcript")
