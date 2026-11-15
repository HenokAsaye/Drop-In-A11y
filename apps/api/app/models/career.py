from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, validates

from app.core.urls import require_media_path, require_web_url
from app.db.base import Base, TimestampMixin


class Career(TimestampMixin, Base):
    __tablename__ = "careers"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    organization: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(255))
    application_url: Mapped[str] = mapped_column(String(1024))
    audio_summary_path: Mapped[str | None] = mapped_column(String(512))
    accommodations: Mapped[str | None] = mapped_column(Text)
    certificate_id: Mapped[str | None] = mapped_column(
        ForeignKey("certificates.id", ondelete="SET NULL")
    )

    @validates("application_url")
    def _check_application_url(self, _key: str, value: str) -> str:
        return require_web_url(value)

    @validates("audio_summary_path")
    def _check_audio_summary_path(self, _key: str, value: str | None) -> str | None:
        return require_media_path(value)
