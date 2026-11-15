import pytest
from pydantic import ValidationError

from app.schemas.lesson import Chapter, MediaSources, TranscriptSegment


def test_transcript_segment_rejects_end_before_start() -> None:
    with pytest.raises(ValidationError):
        TranscriptSegment(start=4, end=1, text="Out of order")


def test_transcript_segment_rejects_negative_time() -> None:
    with pytest.raises(ValidationError):
        TranscriptSegment(start=-1, end=1, text="Negative")


def test_chapter_keeps_a_name_and_non_negative_start() -> None:
    chapter = Chapter(name="  How computers connect  ", start=45)

    assert chapter.model_dump() == {"name": "How computers connect", "start": 45.0}


def test_chapter_rejects_a_blank_name_or_negative_start() -> None:
    with pytest.raises(ValidationError):
        Chapter(name="   ", start=0)
    with pytest.raises(ValidationError):
        Chapter(name="Welcome", start=-1)


def test_media_sources_serialize_with_spec_field_names() -> None:
    media = MediaSources(
        video="/media/networking.mp4",
        sign_language="/media/networking-ethsl.mp4",
        audio_description="/media/networking-description.mp3",
    )

    assert media.model_dump(by_alias=True, exclude_none=True) == {
        "video": "/media/networking.mp4",
        "signLanguage": "/media/networking-ethsl.mp4",
        "audioDescription": "/media/networking-description.mp3",
    }
