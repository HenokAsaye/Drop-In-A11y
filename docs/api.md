# API

Base path `/api/v1`. JSON uses camelCase. The live OpenAPI document is served at `/docs` (non-
production) and committed at `packages/contracts/openapi.json`.

| Method | Endpoint                             | Purpose                              | Status |
| ------ | ------------------------------------ | ------------------------------------ | ------ |
| GET    | `/health`                            | Liveness probe                       | Done   |
| GET    | `/api/v1/lessons/{id}`               | Lesson information                   | Done   |
| GET    | `/api/v1/lessons/{id}/transcript`    | Transcript (`?language=en\|am`)      | Done   |
| GET    | `/api/v1/lessons/{id}/captions`      | Caption track metadata               | Done   |
| GET    | `/api/v1/lessons/{id}/offline`       | Offline package information          | 501    |
| GET    | `/api/v1/lessons/{id}/documents`     | Learning documents                   | Done   |
| GET    | `/api/v1/careers`                    | Career opportunities (`limit`, `offset`) | 501 |
| GET    | `/api/v1/certificates/{id}/verify`   | Verify a certificate                 | 501    |

## Errors

```json
{ "detail": "Lesson 'x' was not found", "code": "not_found", "resource": "Lesson" }
{ "detail": "LessonService.get_lesson is not implemented yet", "code": "not_implemented" }
```

## Example lesson response (target shape)

```json
{
  "id": "networking-101",
  "title": "Introduction to Networking",
  "description": "Learn the fundamentals of computer networking.",
  "language": "en",
  "media": {
    "video": "https://media.example.com/networking-101.mp4",
    "audio": "https://media.example.com/networking-101.mp3",
    "signLanguage": "https://media.example.com/networking-101-ethsl.mp4",
    "audioDescription": "https://media.example.com/networking-101-description.mp3"
  },
  "captions": [
    { "language": "en", "label": "English", "url": "https://media.example.com/networking-101-en.vtt" },
    { "language": "am", "label": "Amharic", "url": "https://media.example.com/networking-101-am.vtt" }
  ],
  "transcripts": [
    { "language": "en", "label": "English", "url": "https://api.example.com/api/v1/lessons/networking-101/transcript?language=en" }
  ],
  "documents": [
    { "title": "Networking Notes", "language": "en", "html": "…/networking-101-notes.html", "pdf": "…/networking-101-notes.pdf" }
  ]
}
```

## Changing the contract

1. Edit Pydantic schemas in `apps/api/app/schemas/`.
2. `pnpm api:openapi && pnpm contracts:generate`.
3. Commit `openapi.json` and `src/generated/api.ts`. CI's contract job fails otherwise.
