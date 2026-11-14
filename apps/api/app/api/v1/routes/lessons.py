from typing import Annotated, Any

from fastapi import APIRouter, Path, Query

from app.api.deps import LessonServiceDep
from app.schemas.common import ErrorResponse
from app.schemas.lesson import (
    CaptionTrackOut,
    LessonDocumentOut,
    LessonOut,
    OfflinePackageOut,
    TranscriptOut,
)

router = APIRouter(prefix="/lessons", tags=["lessons"])

LessonId = Annotated[str, Path(pattern=r"^[a-z0-9][a-z0-9-]{0,63}$", examples=["networking-101"])]
NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"model": ErrorResponse}}


@router.get("/{lesson_id}", response_model=LessonOut, responses=NOT_FOUND)
async def get_lesson(lesson_id: LessonId, service: LessonServiceDep) -> LessonOut:
    """Lesson metadata and resource URLs for the player."""
    return await service.get_lesson(lesson_id)


@router.get("/{lesson_id}/transcript", response_model=TranscriptOut, responses=NOT_FOUND)
async def get_transcript(
    lesson_id: LessonId,
    service: LessonServiceDep,
    language: Annotated[str, Query(min_length=2, max_length=16, examples=["am"])] = "en",
) -> TranscriptOut:
    """Timestamped transcript segments in the requested language."""
    return await service.get_transcript(lesson_id, language)


@router.get("/{lesson_id}/captions", response_model=list[CaptionTrackOut], responses=NOT_FOUND)
async def get_captions(lesson_id: LessonId, service: LessonServiceDep) -> list[CaptionTrackOut]:
    """WebVTT caption track metadata."""
    return await service.get_captions(lesson_id)


@router.get("/{lesson_id}/offline", response_model=OfflinePackageOut, responses=NOT_FOUND)
async def get_offline_package(lesson_id: LessonId, service: LessonServiceDep) -> OfflinePackageOut:
    """Resources a learner can download for offline use."""
    return await service.get_offline_package(lesson_id)


@router.get("/{lesson_id}/documents", response_model=list[LessonDocumentOut], responses=NOT_FOUND)
async def get_documents(lesson_id: LessonId, service: LessonServiceDep) -> list[LessonDocumentOut]:
    """Accessible HTML and tagged PDF learning documents."""
    return await service.get_documents(lesson_id)
