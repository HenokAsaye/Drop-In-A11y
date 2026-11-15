from typing import Literal

from pydantic import Field, model_validator

from app.schemas.common import CamelModel


class MediaSources(CamelModel):
    video: str
    audio: str | None = None
    sign_language: str | None = None
    audio_description: str | None = None
    poster: str | None = None


class CaptionTrackOut(CamelModel):
    language: str = Field(examples=["am"])
    label: str = Field(examples=["Amharic"])
    url: str


class TranscriptRef(CamelModel):
    language: str
    label: str
    url: str


class LessonDocumentOut(CamelModel):
    title: str
    language: str
    html: str | None = None
    pdf: str | None = None


class LessonOut(CamelModel):
    id: str = Field(examples=["networking-101"])
    title: str
    description: str
    language: str
    media: MediaSources
    captions: list[CaptionTrackOut]
    transcripts: list[TranscriptRef]
    documents: list[LessonDocumentOut]


class TranscriptSegment(CamelModel):
    start: float = Field(ge=0, description="Segment start time in seconds")
    end: float = Field(ge=0, description="Segment end time in seconds")
    text: str

    @model_validator(mode="after")
    def _end_after_start(self) -> "TranscriptSegment":
        if self.end < self.start:
            raise ValueError("segment end must be greater than or equal to start")
        return self


class TranscriptOut(CamelModel):
    language: str
    segments: list[TranscriptSegment]


OfflineResourceType = Literal["audio", "transcript", "captions", "html", "document"]


class OfflineResource(CamelModel):
    type: OfflineResourceType
    url: str
    language: str | None = None
    title: str | None = None


class OfflinePackageOut(CamelModel):
    lesson_id: str
    version: str = Field(
        description="Changes whenever the lesson content changes; used as cache key"
    )
    resources: list[OfflineResource]
