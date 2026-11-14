from app.repositories.lessons import LessonRepository
from app.schemas.lesson import (
    CaptionTrackOut,
    LessonDocumentOut,
    LessonOut,
    OfflinePackageOut,
    TranscriptOut,
)
from app.services.urls import UrlBuilder


class LessonService:
    def __init__(self, lessons: LessonRepository, urls: UrlBuilder) -> None:
        self._lessons = lessons
        self._urls = urls

    async def get_lesson(self, lesson_id: str) -> LessonOut:
        raise NotImplementedError("LessonService.get_lesson")

    async def get_transcript(self, lesson_id: str, language: str) -> TranscriptOut:
        raise NotImplementedError("LessonService.get_transcript")

    async def get_captions(self, lesson_id: str) -> list[CaptionTrackOut]:
        raise NotImplementedError("LessonService.get_captions")

    async def get_offline_package(self, lesson_id: str) -> OfflinePackageOut:
        raise NotImplementedError("LessonService.get_offline_package")

    async def get_documents(self, lesson_id: str) -> list[LessonDocumentOut]:
        raise NotImplementedError("LessonService.get_documents")
