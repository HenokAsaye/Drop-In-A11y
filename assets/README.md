# Lesson assets

Media and documents for the demonstration lesson. In production these live in object storage /
a CDN; the API stores **paths** and returns **URLs** — it never streams these files.

| Folder               | Contents                                  | In git?                   |
| -------------------- | ----------------------------------------- | ------------------------- |
| `videos/`            | Main lesson video (`.mp4`)                | No — too large            |
| `audio/`             | Compressed lesson audio for offline mode  | No — too large            |
| `sign-language/`     | Ethiopian Sign Language interpreter video | No — too large            |
| `audio-description/` | Prerecorded audio-description track       | No — too large            |
| `captions/`          | WebVTT caption files                      | Yes                       |
| `transcripts/`       | Timestamped transcript JSON               | Yes                       |
| `documents/`         | Accessible HTML and tagged PDF documents  | Yes                       |

## Naming convention

`<lesson-id>[-<variant>][-<language>].<ext>`, for example:

- `networking-101.mp4`, `networking-101.mp3`
- `networking-101-ethsl.mp4`, `networking-101-description.mp3`
- `networking-101-en.vtt`, `networking-101-am.vtt`
- `networking-101-en.json`, `networking-101-am.json`
- `networking-101-notes.html`, `networking-101-notes.pdf`

## Rebuilding a document PDF

The HTML handout is the source. After editing it, rebuild the tagged PDF (PDF/UA-1) next to it:

```sh
uv run scripts/build_notes_pdf.py assets/documents/networking-101-notes.html
```

`uv` installs the pinned WeasyPrint version on first run. WeasyPrint needs Pango from the system
(`libpango-1.0-0` on Debian and Ubuntu). Check the new PDF with PAC or veraPDF and a screen reader,
and record the result in `docs/testing/manual-test-record.md`.

All media must be prepared and **reviewed by people** (captions, Amharic translation, sign-language
interpretation, audio description). Do not present any of it as automatically generated.

Run `docker compose up media` to serve this folder at `http://localhost:8080` with CORS and range
requests enabled.
