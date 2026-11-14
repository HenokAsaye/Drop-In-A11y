import pytest

from app.core.errors import NotFoundError
from app.models import Lesson, Transcript
from app.repositories.lessons import LessonRepository
from app.services.lessons import LessonService
from app.services.urls import UrlBuilder
from tests.unit.factories import networking_lesson, networking_lesson_json, offline_lesson


class FakeLessonRepository(LessonRepository):
    def __init__(self, lessons: dict[str, Lesson]) -> None:
        self._items = lessons

    async def get(self, lesson_id: str) -> Lesson | None:
        return self._items.get(lesson_id)

    async def get_transcript(self, lesson_id: str, language: str) -> Transcript | None:
        lesson = self._items.get(lesson_id)
        if lesson is None:
            return None
        return next(
            (item for item in lesson.transcripts if item.language == language),
            None,
        )


def service_for(*lessons: Lesson) -> LessonService:
    urls = UrlBuilder("https://media.example.com", "https://api.example.com")
    return LessonService(FakeLessonRepository({lesson.id: lesson for lesson in lessons}), urls)


async def test_get_lesson_returns_documented_camel_case_shape() -> None:
    lesson = await service_for(networking_lesson()).get_lesson("networking-101")

    assert lesson.model_dump(by_alias=True) == networking_lesson_json()


async def test_missing_lesson_raises_not_found() -> None:
    service = service_for()

    with pytest.raises(NotFoundError) as raised:
        await service.get_lesson("missing-lesson")

    assert raised.value.resource == "Lesson"
    assert raised.value.identifier == "missing-lesson"


async def test_captions_and_documents_follow_the_lesson() -> None:
    service = service_for(networking_lesson())

    captions = await service.get_captions("networking-101")
    documents = await service.get_documents("networking-101")

    assert [caption.language for caption in captions] == ["en", "am"]
    assert documents[0].html == "https://media.example.com/networking-101-notes.html"
    assert documents[0].pdf == "https://media.example.com/networking-101-notes.pdf"


async def test_captions_for_unknown_lesson_are_not_found() -> None:
    with pytest.raises(NotFoundError):
        await service_for().get_captions("missing-lesson")


async def test_documents_for_unknown_lesson_are_not_found() -> None:
    with pytest.raises(NotFoundError):
        await service_for().get_documents("missing-lesson")


async def test_get_transcript_returns_stored_segments() -> None:
    transcript = await service_for(networking_lesson()).get_transcript("networking-101", "en")

    assert transcript.model_dump() == {
        "language": "en",
        "segments": [{"start": 0.0, "end": 4.0, "text": "Welcome to our networking lesson."}],
    }


async def test_missing_transcript_language_raises_not_found() -> None:
    with pytest.raises(NotFoundError) as raised:
        await service_for(networking_lesson()).get_transcript("networking-101", "am")

    assert raised.value.resource == "Transcript"
    assert raised.value.identifier == "networking-101:am"


async def test_transcript_for_unknown_lesson_raises_not_found() -> None:
    with pytest.raises(NotFoundError) as raised:
        await service_for().get_transcript("missing-lesson", "en")

    assert raised.value.resource == "Lesson"
    assert raised.value.identifier == "missing-lesson"


async def test_absolute_media_url_is_not_rewritten() -> None:
    lesson = networking_lesson()
    lesson.video_path = "https://cdn.example/networking-101.mp4"

    loaded = await service_for(lesson).get_lesson("networking-101")

    assert loaded.media.video == "https://cdn.example/networking-101.mp4"


async def test_get_offline_package_returns_declared_package_shape() -> None:
    service = service_for(offline_lesson())

    package = await service.get_offline_package("networking-101")

    assert package.lesson_id == "networking-101"
    assert package.version
    assert len(package.resources) == 8

    # All URLs must be absolute
    for resource in package.resources:
        assert resource.url.startswith("https://")

    # Resource types present
    types = {r.type for r in package.resources}
    assert types == {"audio", "transcript", "captions", "html", "document"}

    # Audio
    audio = [r for r in package.resources if r.type == "audio"]
    assert len(audio) == 1
    assert audio[0].url == "https://media.example.com/networking-101.mp3"
    assert audio[0].language == "en"
    assert audio[0].title == "Introduction to Networking"

    # Both transcripts
    transcripts = [r for r in package.resources if r.type == "transcript"]
    assert len(transcripts) == 2
    assert [t.language for t in transcripts] == ["en", "am"]
    assert (
        transcripts[0].url
        == "https://api.example.com/api/v1/lessons/networking-101/transcript?language=en"
    )
    assert transcripts[0].title == "English"
    assert (
        transcripts[1].url
        == "https://api.example.com/api/v1/lessons/networking-101/transcript?language=am"
    )
    assert transcripts[1].title == "Amharic"

    # Captions
    captions = [r for r in package.resources if r.type == "captions"]
    assert len(captions) == 2
    assert [c.language for c in captions] == ["en", "am"]
    assert captions[0].url == "https://media.example.com/networking-101-en.vtt"
    assert captions[0].title == "English"
    assert captions[1].url == "https://media.example.com/networking-101-am.vtt"
    assert captions[1].title == "Amharic"

    # Offline HTML
    html = [r for r in package.resources if r.type == "html"]
    assert len(html) == 1
    assert html[0].url == "https://media.example.com/networking-101-offline.html"
    assert html[0].language == "en"
    assert html[0].title == "Introduction to Networking"

    # Document
    docs = [r for r in package.resources if r.type == "document"]
    assert len(docs) == 2
    assert {d.url for d in docs} == {
        "https://media.example.com/networking-101-notes.html",
        "https://media.example.com/networking-101-notes.pdf",
    }
    assert all(d.language == "en" for d in docs)
    assert all(d.title == "Networking Notes" for d in docs)

    # Wire shape uses camelCase (lessonId, version, resources)
    wire = package.model_dump(by_alias=True)
    assert wire["lessonId"] == "networking-101"
    assert wire["version"] == package.version
    assert len(wire["resources"]) == 8


async def test_offline_package_for_unknown_lesson_raises_not_found() -> None:
    service = service_for()

    with pytest.raises(NotFoundError) as raised:
        await service.get_offline_package("missing-lesson")

    assert raised.value.resource == "Lesson"
    assert raised.value.identifier == "missing-lesson"


async def test_offline_package_version_changes_when_content_changes() -> None:
    base_lesson = offline_lesson()
    v_base = (await service_for(base_lesson).get_offline_package("networking-101")).version

    # Title changed
    changed_title = offline_lesson()
    changed_title.title = "Advanced Networking"
    v_title = (await service_for(changed_title).get_offline_package("networking-101")).version
    assert v_title != v_base

    # Audio changed
    changed_audio = offline_lesson()
    changed_audio.audio_path = "networking-101-v2.mp3"
    v_audio = (await service_for(changed_audio).get_offline_package("networking-101")).version
    assert v_audio != v_base

    # Offline HTML changed
    changed_html = offline_lesson()
    changed_html.offline_html_path = "networking-101-v2.html"
    v_html = (await service_for(changed_html).get_offline_package("networking-101")).version
    assert v_html != v_base

    # Transcript changed
    changed_transcript = offline_lesson()
    changed_transcript.transcripts[0].segments[0]["text"] = "Changed transcript segment"
    v_trans = (await service_for(changed_transcript).get_offline_package("networking-101")).version
    assert v_trans != v_base
