from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

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
