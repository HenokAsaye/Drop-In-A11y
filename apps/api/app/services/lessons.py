from urllib.parse import urlencode

from app.core.errors import NotFoundError
from app.models import Lesson
from app.repositories.lessons import LessonRepository
from app.schemas.lesson import (
    CaptionTrackOut,
    LessonDocumentOut,
    LessonOut,
    MediaSources,
    OfflinePackageOut,
    TranscriptOut,
    TranscriptRef,
    TranscriptSegment,
)
from app.services.urls import UrlBuilder


class LessonService:
    def __init__(self, lessons: LessonRepository, urls: UrlBuilder) -> None:
        self._lessons = lessons
        self._urls = urls

    async def get_lesson(self, lesson_id: str) -> LessonOut:
        return self._to_lesson(await self._require(lesson_id))

    async def get_transcript(self, lesson_id: str, language: str) -> TranscriptOut:
        transcript = await self._lessons.get_transcript(lesson_id, language)
        if transcript is None:
            await self._require(lesson_id)
            raise NotFoundError("Transcript", f"{lesson_id}:{language}")
        return TranscriptOut(
            language=transcript.language,
            segments=[TranscriptSegment.model_validate(segment) for segment in transcript.segments],
        )

    async def get_captions(self, lesson_id: str) -> list[CaptionTrackOut]:
        return self._to_lesson(await self._require(lesson_id)).captions

    async def get_offline_package(self, lesson_id: str) -> OfflinePackageOut:
        raise NotImplementedError("LessonService.get_offline_package")

    async def get_documents(self, lesson_id: str) -> list[LessonDocumentOut]:
        return self._to_lesson(await self._require(lesson_id)).documents

    async def _require(self, lesson_id: str) -> Lesson:
        lesson = await self._lessons.get(lesson_id)
        if lesson is None:
            raise NotFoundError("Lesson", lesson_id)
        return lesson

    def _to_lesson(self, lesson: Lesson) -> LessonOut:
        return LessonOut(
            id=lesson.id,
            title=lesson.title,
            description=lesson.description,
            language=lesson.language,
            media=MediaSources(
                video=self._media_url(lesson.video_path),
                audio=self._urls.media(lesson.audio_path),
                sign_language=self._urls.media(lesson.sign_language_path),
                audio_description=self._urls.media(lesson.audio_description_path),
                poster=self._urls.media(lesson.poster_path),
            ),
            captions=[
                CaptionTrackOut(
                    language=track.language,
                    label=track.label,
                    url=self._media_url(track.path),
                )
                for track in lesson.captions
            ],
            transcripts=[
                TranscriptRef(
                    language=transcript.language,
                    label=transcript.label,
                    url=self._transcript_url(lesson.id, transcript.language),
                )
                for transcript in lesson.transcripts
            ],
            documents=[
                LessonDocumentOut(
                    title=document.title,
                    language=document.language,
                    html=self._urls.media(document.html_path),
                    pdf=self._urls.media(document.pdf_path),
                )
                for document in lesson.documents
            ],
        )

    def _transcript_url(self, lesson_id: str, language: str) -> str:
        query = urlencode({"language": language})
        return self._urls.api(f"/api/v1/lessons/{lesson_id}/transcript?{query}")

    def _media_url(self, path: str) -> str:
        url = self._urls.media(path)
        if url is None:
            raise ValueError("media path is empty")
        return url
