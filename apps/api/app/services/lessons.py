import hashlib
import json
from datetime import datetime
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
    OfflineResource,
    TranscriptOut,
    TranscriptRef,
)
from app.services.urls import UrlBuilder


class LessonService:
    def __init__(self, lessons: LessonRepository, urls: UrlBuilder) -> None:
        self._lessons = lessons
        self._urls = urls

    async def get_lesson(self, lesson_id: str) -> LessonOut:
        return self._to_lesson(await self._require(lesson_id))

    async def get_transcript(self, lesson_id: str, language: str) -> TranscriptOut:
        raise NotImplementedError("LessonService.get_transcript")

    async def get_captions(self, lesson_id: str) -> list[CaptionTrackOut]:
        return self._to_lesson(await self._require(lesson_id)).captions

    async def get_offline_package(self, lesson_id: str) -> OfflinePackageOut:
        lesson = await self._require(lesson_id)
        return self._to_offline_package(lesson)

    async def get_documents(self, lesson_id: str) -> list[LessonDocumentOut]:
        return self._to_lesson(await self._require(lesson_id)).documents

    async def _require(self, lesson_id: str) -> Lesson:
        lesson = await self._lessons.get(lesson_id)
        if lesson is None:
            raise NotFoundError("Lesson", lesson_id)
        return lesson

    def _to_offline_package(self, lesson: Lesson) -> OfflinePackageOut:
        resources: list[OfflineResource] = []

        if lesson.audio_path:
            resources.append(
                OfflineResource(
                    type="audio",
                    url=self._media_url(lesson.audio_path),
                    language=lesson.language,
                    title=lesson.title,
                )
            )

        for transcript in lesson.transcripts:
            resources.append(
                OfflineResource(
                    type="transcript",
                    url=self._transcript_url(lesson.id, transcript.language),
                    language=transcript.language,
                    title=transcript.label,
                )
            )

        for track in lesson.captions:
            resources.append(
                OfflineResource(
                    type="captions",
                    url=self._media_url(track.path),
                    language=track.language,
                    title=track.label,
                )
            )

        if lesson.offline_html_path:
            resources.append(
                OfflineResource(
                    type="html",
                    url=self._media_url(lesson.offline_html_path),
                    language=lesson.language,
                    title=lesson.title,
                )
            )

        for document in lesson.documents:
            if document.html_path:
                resources.append(
                    OfflineResource(
                        type="document",
                        url=self._media_url(document.html_path),
                        language=document.language,
                        title=document.title,
                    )
                )
            if document.pdf_path:
                resources.append(
                    OfflineResource(
                        type="document",
                        url=self._media_url(document.pdf_path),
                        language=document.language,
                        title=document.title,
                    )
                )

        version = self._lesson_version(lesson)
        return OfflinePackageOut(
            lesson_id=lesson.id,
            version=version,
            resources=resources,
        )

    def _lesson_version(self, lesson: Lesson) -> str:
        updated_at_val = getattr(lesson, "updated_at", None)
        updated_at_str = (
            updated_at_val.isoformat() if isinstance(updated_at_val, datetime) else None
        )
        payload = {
            "id": lesson.id,
            "title": lesson.title,
            "description": lesson.description,
            "language": lesson.language,
            "video_path": lesson.video_path,
            "audio_path": lesson.audio_path,
            "sign_language_path": lesson.sign_language_path,
            "audio_description_path": lesson.audio_description_path,
            "poster_path": lesson.poster_path,
            "offline_html_path": lesson.offline_html_path,
            "updated_at": updated_at_str,
            "captions": [
                {"language": c.language, "label": c.label, "path": c.path}
                for c in sorted(lesson.captions, key=lambda c: (c.language, c.path))
            ],
            "transcripts": [
                {"language": t.language, "label": t.label, "segments": t.segments}
                for t in sorted(lesson.transcripts, key=lambda t: t.language)
            ],
            "documents": [
                {
                    "title": d.title,
                    "language": d.language,
                    "html_path": d.html_path,
                    "pdf_path": d.pdf_path,
                    "position": d.position,
                }
                for d in sorted(lesson.documents, key=lambda d: (d.position, d.title))
            ],
        }
        encoded = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()[:16]

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
