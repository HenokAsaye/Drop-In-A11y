from typing import Any

from sqlalchemy import JSON, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Lesson(TimestampMixin, Base):
    __tablename__ = "lessons"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    language: Mapped[str] = mapped_column(String(16), default="en")

    # Paths are relative to the media base URL (object storage); the API never proxies media.
    video_path: Mapped[str] = mapped_column(String(512))
    audio_path: Mapped[str | None] = mapped_column(String(512))
    sign_language_path: Mapped[str | None] = mapped_column(String(512))
    audio_description_path: Mapped[str | None] = mapped_column(String(512))
    poster_path: Mapped[str | None] = mapped_column(String(512))
    offline_html_path: Mapped[str | None] = mapped_column(String(512))

    captions: Mapped[list["CaptionTrack"]] = relationship(
        back_populates="lesson", cascade="all, delete-orphan", order_by="CaptionTrack.id"
    )
    transcripts: Mapped[list["Transcript"]] = relationship(
        back_populates="lesson", cascade="all, delete-orphan", order_by="Transcript.id"
    )
    documents: Mapped[list["LessonDocument"]] = relationship(
        back_populates="lesson", cascade="all, delete-orphan", order_by="LessonDocument.position"
    )


class CaptionTrack(Base):
    __tablename__ = "caption_tracks"
    __table_args__ = (UniqueConstraint("lesson_id", "language"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    lesson_id: Mapped[str] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"), index=True)
    language: Mapped[str] = mapped_column(String(16))
    label: Mapped[str] = mapped_column(String(64))
    path: Mapped[str] = mapped_column(String(512))

    lesson: Mapped[Lesson] = relationship(back_populates="captions")


class Transcript(Base):
    __tablename__ = "transcripts"
    __table_args__ = (UniqueConstraint("lesson_id", "language"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    lesson_id: Mapped[str] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"), index=True)
    language: Mapped[str] = mapped_column(String(16))
    label: Mapped[str] = mapped_column(String(64))
    # [{"start": float, "end": float, "text": str}, ...] ordered by start time.
    segments: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)

    lesson: Mapped[Lesson] = relationship(back_populates="transcripts")


class LessonDocument(Base):
    __tablename__ = "lesson_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    lesson_id: Mapped[str] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    language: Mapped[str] = mapped_column(String(16), default="en")
    html_path: Mapped[str | None] = mapped_column(String(512))
    pdf_path: Mapped[str | None] = mapped_column(String(512))
    position: Mapped[int] = mapped_column(default=0)

    lesson: Mapped[Lesson] = relationship(back_populates="documents")
