"""Transcript pipeline: reviewed, timestamped transcript JSON -> WebVTT caption files."""

from app.schemas.lesson import TranscriptSegment


def format_timestamp(seconds: float) -> str:
    """Format seconds as a WebVTT timestamp (HH:MM:SS.mmm)."""
    total_milliseconds = round(seconds * 1000)
    hours, remainder = divmod(total_milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    whole_seconds, milliseconds = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{whole_seconds:02d}.{milliseconds:03d}"


def segments_to_webvtt(segments: list[TranscriptSegment]) -> str:
    """Render ordered transcript segments as a WebVTT document."""
    cues = [
        f"{format_timestamp(segment.start)} --> {format_timestamp(segment.end)}\n{segment.text}\n"
        for segment in segments
    ]
    return "WEBVTT\n\n" + "\n".join(cues)
