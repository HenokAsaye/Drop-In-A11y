"""Specification tests for the transcript -> WebVTT pipeline (spec 4.5, 5.2).

Marked strict xfail until implemented: implementing the pipeline makes these pass,
which fails the suite until the marker is removed.
"""

import pytest

from app.schemas.lesson import TranscriptSegment
from app.services.transcripts import format_timestamp, segments_to_webvtt

pending = pytest.mark.xfail(raises=NotImplementedError, strict=True, reason="not implemented")


@pending
@pytest.mark.parametrize(
    ("seconds", "expected"),
    [(0, "00:00:00.000"), (4.5, "00:00:04.500"), (3725.25, "01:02:05.250")],
)
def test_format_timestamp(seconds: float, expected: str) -> None:
    assert format_timestamp(seconds) == expected


@pending
def test_segments_render_as_webvtt() -> None:
    segments = [
        TranscriptSegment(start=1, end=4, text="Welcome to our introduction to networking."),
        TranscriptSegment(
            start=4.5, end=8, text="Today, we will learn how computer networks work."
        ),
    ]

    assert segments_to_webvtt(segments) == (
        "WEBVTT\n\n"
        "00:00:01.000 --> 00:00:04.000\n"
        "Welcome to our introduction to networking.\n\n"
        "00:00:04.500 --> 00:00:08.000\n"
        "Today, we will learn how computer networks work.\n"
    )


@pending
def test_amharic_text_is_preserved() -> None:
    segments = [TranscriptSegment(start=0, end=2, text="እንኳን ደህና መጡ")]

    assert "እንኳን ደህና መጡ" in segments_to_webvtt(segments)
