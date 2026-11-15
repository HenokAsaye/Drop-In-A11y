"""Stored links and media paths only ever hold http(s) URLs or storage paths (spec 4.7, 4.8)."""

import pytest

from app.core.urls import is_web_url, require_media_path, require_web_url
from app.models import CaptionTrack, Career, Lesson, LessonDocument

UNSAFE = [
    "javascript:alert(1)",
    " JavaScript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
]


@pytest.mark.parametrize("value", ["https://jobs.example/apply", "http://localhost:8080/a.mp3"])
def test_absolute_http_urls_are_web_urls(value: str) -> None:
    assert is_web_url(value)


@pytest.mark.parametrize("value", [*UNSAFE, "https:///no-host", "/relative/path", "jobs.example"])
def test_other_values_are_not_web_urls(value: str) -> None:
    assert not is_web_url(value)


@pytest.mark.parametrize("value", UNSAFE)
def test_require_web_url_refuses_unsafe_schemes(value: str) -> None:
    with pytest.raises(ValueError, match="http or https"):
        require_web_url(value)


@pytest.mark.parametrize(
    "value", [None, "documents/notes.pdf", "/audio/summary.mp3", "https://cdn.example/a.mp4"]
)
def test_media_paths_and_web_urls_are_accepted(value: str | None) -> None:
    assert require_media_path(value) == value


@pytest.mark.parametrize("value", UNSAFE)
def test_media_path_refuses_unsafe_schemes(value: str) -> None:
    with pytest.raises(ValueError):
        require_media_path(value)


def _career(**overrides: object) -> Career:
    values: dict[str, object] = {
        "title": "Network technician",
        "organization": "Savanna Labs",
        "description": "Install and support campus networks.",
        "application_url": "https://jobs.example/network-technician",
        "audio_summary_path": "audio/network-technician.mp3",
    }
    values.update(overrides)
    return Career(**values)


def test_career_keeps_a_web_application_url() -> None:
    assert _career().application_url == "https://jobs.example/network-technician"


@pytest.mark.parametrize("value", UNSAFE)
def test_career_refuses_an_unsafe_application_url(value: str) -> None:
    with pytest.raises(ValueError):
        _career(application_url=value)


def test_career_refuses_an_unsafe_url_set_after_creation() -> None:
    career = _career()
    with pytest.raises(ValueError):
        career.application_url = "javascript:alert(1)"


def test_career_refuses_an_unsafe_audio_summary() -> None:
    with pytest.raises(ValueError):
        _career(audio_summary_path="data:audio/mpeg;base64,AAAA")


def test_lesson_document_refuses_an_unsafe_link() -> None:
    with pytest.raises(ValueError):
        LessonDocument(title="Notes", html_path="javascript:alert(1)")


def test_lesson_media_and_caption_paths_refuse_unsafe_schemes() -> None:
    with pytest.raises(ValueError):
        Lesson(id="x", title="X", video_path="javascript:alert(1)")
    with pytest.raises(ValueError):
        CaptionTrack(language="en", label="English", path="data:text/vtt,WEBVTT")
