import pytest

from app.core.errors import NotFoundError
from app.models import Lesson, Transcript
from app.repositories.lessons import LessonRepository
from app.services.lessons import LessonService
from app.services.urls import UrlBuilder
from tests.unit.factories import networking_lesson, networking_lesson_json


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
