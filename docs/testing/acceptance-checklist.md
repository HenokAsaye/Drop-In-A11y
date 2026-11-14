# Acceptance checklist

From specification section 11. "Verified by" names the automated test that proves the item, or
`Manual` when it must be recorded in [manual-test-record.md](manual-test-record.md).

## Functional

| # | Criterion | Verified by | Status |
|---|-----------|-------------|--------|
| F1 | Another website can install the plugin using a script tag | `e2e/embed.spec.ts` — host page loads the plugin | ☑ (skeleton) |
| F2 | The plugin loads a lesson from the API | `e2e/embed.spec.ts`, `player/test/savanna-player.test.ts` | ☐ |
| F3 | Video playback works | `e2e/embed.spec.ts` | ☐ |
| F4 | English captions work | `player/test/captions.test.ts`, e2e | ☐ |
| F5 | Amharic captions work | `player/test/captions.test.ts`, e2e | ☐ |
| F6 | Caption size and colors can be adjusted | `player/test/captions.test.ts`, e2e | ☐ |
| F7 | Sign-language video can be shown, moved and resized | `player/test/media-sync.test.ts`, e2e | ☐ |
| F8 | Sign-language playback follows the main video | `player/test/media-sync.test.ts` | ☐ |
| F9 | Audio description can be enabled | `player/test/media-sync.test.ts` | ☐ |
| F10 | Transcript highlights the current sentence | `player/test/transcript.test.ts` | ☐ |
| F11 | Clicking a transcript sentence seeks the video | `player/test/transcript.test.ts`, e2e | ☐ |
| F12 | Audio and text resources can be downloaded | `offline/test/storage.test.ts` | ☐ |
| F13 | Downloaded resources work offline | `e2e/accessibility.spec.ts` (offline), Manual | ☐ |
| F14 | Accessible HTML and tagged PDF resources are available | API `documents` endpoint, Manual (PAC / NVDA) | ☐ |
| F15 | Career cards work at 200% zoom | `e2e/accessibility.spec.ts`, Manual | ☐ |
| F16 | Career audio summaries work | `career/test/career.test.ts` | ☐ |
| F17 | Certificate verification links work | `career/test/career.test.ts`, API verify endpoint | ☐ |

## Accessibility

| # | Criterion | Verified by | Status |
|---|-----------|-------------|--------|
| A1 | All interactive controls work using a keyboard | e2e keyboard test, Manual | ☐ |
| A2 | Keyboard focus is always visible | Manual, `player/test/savanna-player.test.ts` | ☐ |
| A3 | Screen readers announce controls meaningfully | Manual (NVDA, TalkBack) | ☐ |
| A4 | There are no keyboard traps | e2e keyboard-trap test, Manual | ☐ |
| A5 | Captions are readable and customizable | `player/test/captions.test.ts`, Manual | ☐ |
| A6 | Content remains usable at 200% zoom | e2e zoom test, Manual | ☐ |
| A7 | The interface works with sound off | Manual | ☐ |
| A8 | axe-core reports zero critical and serious violations | `e2e/accessibility.spec.ts` | ☑ (skeleton page) |
| A9 | Manual testing completed with NVDA and other AT | [manual-test-record.md](manual-test-record.md) | ☐ |

## Demonstration scenario (spec 12)

Rehearse on the demo page with the "Introduction to Computer Networking" lesson:

1. Open the host website and show the script tag.
2. Play the lesson; switch English ↔ Amharic captions.
3. Increase caption size, change caption background.
4. Enable the sign-language window; move and resize it.
5. Enable audio description.
6. Open the transcript and click a sentence.
7. Download audio and transcript; disconnect; reopen the downloaded lesson.
8. Open an accessible document.
9. Navigate to a career card by keyboard; play the summary; follow the verification link.
10. Demonstrate screen-reader navigation and 200% zoom.

Clearly state which content is prerecorded or manually prepared.
