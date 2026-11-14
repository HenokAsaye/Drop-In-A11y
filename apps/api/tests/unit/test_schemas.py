import pytest
from pydantic import ValidationError

from app.schemas.lesson import MediaSources, TranscriptSegment


def test_transcript_segment_rejects_end_before_start() -> None:
    with pytest.raises(ValidationError):
        TranscriptSegment(start=4, end=1, text="Out of order")


def test_transcript_segment_rejects_negative_time() -> None:
    with pytest.raises(ValidationError):
        TranscriptSegment(start=-1, end=1, text="Negative")


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
