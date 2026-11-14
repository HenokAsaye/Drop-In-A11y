"""Transcript pipeline: reviewed, timestamped transcript JSON -> WebVTT caption files."""

from app.schemas.lesson import TranscriptSegment


def format_timestamp(seconds: float) -> str:
    """Format seconds as a WebVTT timestamp (HH:MM:SS.mmm)."""
    raise NotImplementedError("format_timestamp")


def segments_to_webvtt(segments: list[TranscriptSegment]) -> str:
    """Render ordered transcript segments as a WebVTT document."""
    raise NotImplementedError("segments_to_webvtt")
