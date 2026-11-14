"""Initial schema for lessons, documents, careers and certificates.

Revision ID: 0001_initial
Revises:
Create Date: 2026-11-14
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "lessons",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("language", sa.String(length=16), nullable=False),
        sa.Column("video_path", sa.String(length=512), nullable=False),
        sa.Column("audio_path", sa.String(length=512), nullable=True),
        sa.Column("sign_language_path", sa.String(length=512), nullable=True),
        sa.Column("audio_description_path", sa.String(length=512), nullable=True),
        sa.Column("poster_path", sa.String(length=512), nullable=True),
        sa.Column("offline_html_path", sa.String(length=512), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_lessons"),
    )
    op.create_table(
        "caption_tracks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lesson_id", sa.String(length=64), nullable=False),
        sa.Column("language", sa.String(length=16), nullable=False),
        sa.Column("label", sa.String(length=64), nullable=False),
        sa.Column("path", sa.String(length=512), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_caption_tracks"),
        sa.ForeignKeyConstraint(
            ["lesson_id"],
            ["lessons.id"],
            name="fk_caption_tracks_lesson_id_lessons",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("lesson_id", "language", name="uq_caption_tracks_lesson_id"),
    )
    op.create_index("ix_caption_tracks_lesson_id", "caption_tracks", ["lesson_id"])
    op.create_table(
        "transcripts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lesson_id", sa.String(length=64), nullable=False),
        sa.Column("language", sa.String(length=16), nullable=False),
        sa.Column("label", sa.String(length=64), nullable=False),
        sa.Column("segments", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_transcripts"),
        sa.ForeignKeyConstraint(
            ["lesson_id"],
            ["lessons.id"],
            name="fk_transcripts_lesson_id_lessons",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("lesson_id", "language", name="uq_transcripts_lesson_id"),
    )
    op.create_index("ix_transcripts_lesson_id", "transcripts", ["lesson_id"])
    op.create_table(
        "lesson_documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lesson_id", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("language", sa.String(length=16), nullable=False),
        sa.Column("html_path", sa.String(length=512), nullable=True),
        sa.Column("pdf_path", sa.String(length=512), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_lesson_documents"),
        sa.ForeignKeyConstraint(
            ["lesson_id"],
            ["lessons.id"],
            name="fk_lesson_documents_lesson_id_lessons",
            ondelete="CASCADE",
        ),
    )
    op.create_index("ix_lesson_documents_lesson_id", "lesson_documents", ["lesson_id"])
    op.create_table(
        "certificates",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("holder_name", sa.String(length=255), nullable=False),
        sa.Column("course_title", sa.String(length=255), nullable=False),
        sa.Column("issuer", sa.String(length=255), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lesson_id", sa.String(length=64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_certificates"),
        sa.ForeignKeyConstraint(
            ["lesson_id"],
            ["lessons.id"],
            name="fk_certificates_lesson_id_lessons",
            ondelete="SET NULL",
        ),
    )
    op.create_table(
        "careers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("organization", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("application_url", sa.String(length=1024), nullable=False),
        sa.Column("audio_summary_path", sa.String(length=512), nullable=True),
        sa.Column("accommodations", sa.Text(), nullable=True),
        sa.Column("certificate_id", sa.String(length=64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_careers"),
        sa.ForeignKeyConstraint(
            ["certificate_id"],
            ["certificates.id"],
            name="fk_careers_certificate_id_certificates",
            ondelete="SET NULL",
        ),
    )


def downgrade() -> None:
    op.drop_table("careers")
    op.drop_table("certificates")
    op.drop_index("ix_lesson_documents_lesson_id", table_name="lesson_documents")
    op.drop_table("lesson_documents")
    op.drop_index("ix_transcripts_lesson_id", table_name="transcripts")
    op.drop_table("transcripts")
    op.drop_index("ix_caption_tracks_lesson_id", table_name="caption_tracks")
    op.drop_table("caption_tracks")
    op.drop_table("lessons")
