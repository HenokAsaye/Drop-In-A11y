from app.models import CaptionTrack, Lesson, LessonDocument, Transcript


def networking_lesson() -> Lesson:
    """The demonstration lesson shape from docs/api.md, stored as relative media paths."""
    lesson = Lesson(
        id="networking-101",
        title="Introduction to Networking",
        description="Learn the fundamentals of computer networking.",
        language="en",
        video_path="networking-101.mp4",
        audio_path="networking-101.mp3",
        sign_language_path="networking-101-ethsl.mp4",
        audio_description_path="networking-101-description.mp3",
    )
    lesson.captions = [
        CaptionTrack(language="en", label="English", path="networking-101-en.vtt"),
        CaptionTrack(language="am", label="Amharic", path="networking-101-am.vtt"),
    ]
    lesson.transcripts = [
        Transcript(
            language="en",
            label="English",
            segments=[{"start": 0, "end": 4, "text": "Welcome to our networking lesson."}],
        )
    ]
    lesson.documents = [
        LessonDocument(
            title="Networking Notes",
            language="en",
            html_path="networking-101-notes.html",
            pdf_path="networking-101-notes.pdf",
            position=0,
        )
    ]
    return lesson


def offline_lesson() -> Lesson:
    """Lesson fixture with audio, both transcripts, captions, offline HTML, and one document."""
    lesson = networking_lesson()
    lesson.offline_html_path = "networking-101-offline.html"
    lesson.transcripts = [
        Transcript(
            language="en",
            label="English",
            segments=[{"start": 0, "end": 4, "text": "Welcome to our networking lesson."}],
        ),
        Transcript(
            language="am",
            label="Amharic",
            segments=[{"start": 0, "end": 4, "text": "እንኳን ወደ ኔትወርክ ትምህርታችን በደህና መጡ።"}],
        ),
    ]
    return lesson


def networking_lesson_json() -> dict[str, object]:
    media = "https://media.example.com"
    api = "https://api.example.com"
    return {
        "id": "networking-101",
        "title": "Introduction to Networking",
        "description": "Learn the fundamentals of computer networking.",
        "language": "en",
        "media": {
            "video": f"{media}/networking-101.mp4",
            "audio": f"{media}/networking-101.mp3",
            "signLanguage": f"{media}/networking-101-ethsl.mp4",
            "audioDescription": f"{media}/networking-101-description.mp3",
            "poster": None,
        },
        "captions": [
            {"language": "en", "label": "English", "url": f"{media}/networking-101-en.vtt"},
            {"language": "am", "label": "Amharic", "url": f"{media}/networking-101-am.vtt"},
        ],
        "transcripts": [
            {
                "language": "en",
                "label": "English",
                "url": f"{api}/api/v1/lessons/networking-101/transcript?language=en",
            }
        ],
        "documents": [
            {
                "title": "Networking Notes",
                "language": "en",
                "html": f"{media}/networking-101-notes.html",
                "pdf": f"{media}/networking-101-notes.pdf",
            }
        ],
    }
