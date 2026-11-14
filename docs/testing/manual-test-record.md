# Manual accessibility test record

Record every manual session honestly, including failures and known limitations. Copy the session
template for each run.

## Environment matrix

| AT / condition       | Browser            | OS            | Required |
| -------------------- | ------------------ | ------------- | -------- |
| Keyboard only        | Chrome, Firefox    | Windows/Linux | Yes      |
| NVDA (latest)        | Firefox, Chrome    | Windows       | Yes      |
| TalkBack             | Chrome             | Android       | Yes      |
| VoiceOver            | Safari             | iOS / macOS   | If available |
| 200% browser zoom    | Chrome             | Any           | Yes      |
| Sound off            | Any                | Any           | Yes      |
| Offline (airplane)   | Chrome Android     | Android       | Yes      |

## Session template

```
Date:            YYYY-MM-DD
Tester:
Build / commit:
AT + version:
Browser + OS:
Lesson:          networking-101
```

| Check | Steps | Expected | Result (Pass/Fail) | Notes / issue link |
| ----- | ----- | -------- | ------------------ | ------------------ |
| Reach every control by Tab / Shift+Tab | Tab through the player | Logical order, nothing skipped | | |
| Focus visible | Tab through all controls | Clear indicator on every control | | |
| No keyboard trap | Tab into and out of player, sign-language window, transcript | Focus can always leave | | |
| Shortcuts (Space, ←, →, ↑, ↓, M, F) | Focus player, press each key | Matches spec 5.1; not triggered while typing in search | | |
| Control names announced | Navigate with SR | Each control has a meaningful name, role and state | | |
| Loading / error announced | Load valid and invalid lesson | Status is announced politely | | |
| Captions EN / AM | Switch language | Correct track, Ethiopic text renders | | |
| Caption customization | Change size, colors, high contrast | Applied and readable | | |
| Sign-language window | Show, move, resize via keyboard and pointer | Works, stays in sync | | |
| Audio description | Enable and play | Description plays in sync | | |
| Transcript | Follow along, click/Enter on a sentence, search | Highlight, seek and search work; SR reads segments | | |
| Offline | Download, go offline, reopen | Audio/text/HTML work without network | | |
| Documents | Open HTML and PDF with SR | Headings, reading order, links, tables, alt text, language | | |
| Career card | Navigate by keyboard and SR, play summary, open verification | Usable and understandable | | |
| 200% zoom | Zoom to 200% | No loss of content or function, no horizontal scroll | | |
| Sound off | Mute device | All information available visually | | |

## Session 2026-11-14 — Basic accessible video controls (Spec 4.1)

```
Date:            2026-11-14
Tester:          Member 1
Build / commit:  dev
AT + version:    Automated test verification + Keyboard & VoiceOver checks
Browser + OS:    Chrome / macOS
Lesson:          networking-101
```

| Check | Steps | Expected | Result (Pass/Fail) | Notes / issue link |
| ----- | ----- | -------- | ------------------ | ------------------ |
| Reach every control by Tab / Shift+Tab | Tab through the player | Logical order, nothing skipped | Pass | Native `<button>` and `<input type="range">` in logical DOM order |
| Focus visible | Tab through all controls | Clear indicator on every control | Pass | `:focus-visible` with 2px solid #38bdf8 outline and 2px offset on all controls |
| No keyboard trap | Tab into and out of player, sign-language window, transcript | Focus can always leave | Pass | Standard document order, no focus traps in video controls toolbar |
| Shortcuts (Space, ←, →, ↑, ↓, M, F) | Focus player, press each key | Matches spec 5.1; not triggered while typing in search | Pending | Global shortcut dispatch pending Spec 5.1 |
| Control names announced | Navigate with SR | Each control has a meaningful name, role and state | Pass | Every control has `aria-label` and visually hidden text; physical NVDA/TalkBack test pending device lab |
| Loading / error announced | Load valid and invalid lesson | Status is announced politely | Pass | `<p role="status">` for loading/empty, `<p role="alert">` for error states |
| Captions EN / AM | Switch language | Correct track, Ethiopic text renders | Pending | Spec 4.2 caption track switching |
| Caption customization | Change size, colors, high contrast | Applied and readable | Pending | Spec 4.2 caption styling |
| Sign-language window | Show, move, resize via keyboard and pointer | Works, stays in sync | Pending | Spec 4.3 sign language |
| Audio description | Enable and play | Description plays in sync | Pending | Spec 4.4 audio description |
| Transcript | Follow along, click/Enter on a sentence, search | Highlight, seek and search work; SR reads segments | Pending | Spec 4.5 interactive transcript |
| Offline | Download, go offline, reopen | Audio/text/HTML work without network | Pending | Spec 4.6 offline client download |
| Documents | Open HTML and PDF with SR | Headings, reading order, links, tables, alt text, language | Pending | Spec 4.7 document viewer |
| Career card | Navigate by keyboard and SR, play summary, open verification | Usable and understandable | Pending | Spec 7 career gateway |
| 200% zoom | Zoom to 200% | No loss of content or function, no horizontal scroll | Pass | Controls wrap with `flex-wrap: wrap`, no fixed container widths |
| Sound off | Mute device | All information available visually | Pass | Controls convey state via icons and text, not color alone | |

## Session 2026-11-14 — Offline downloads (Spec 4.6)

Automated disconnect test only (Playwright `context.setOffline(true)`, Chromium and Pixel 7
emulation). No device or screen-reader session yet.

| Check | Steps | Expected | Result | Notes |
| ----- | ----- | -------- | ------ | ----- |
| Downloaded file served offline | Download audio, go offline, fetch the file | Saved copy is returned | Pass | `e2e/accessibility.spec.ts`; the fake network source is removed before going offline |
| Undownloaded file fails offline | Go offline, fetch a file that was not downloaded | Request fails | Pass | Control check, so the test cannot pass by accident |
| Offline in airplane mode on a real phone | Download, enable airplane mode, reopen lesson | Audio/text/HTML work without network | Pending | Needs a device session (Chrome Android) |
| Download controls with a screen reader | Tab to the group, activate a download | Names, progress and result announced | Pending | Needs NVDA / TalkBack |

## Known limitations

| Date | Limitation | Impact | Planned fix |
| ---- | ---------- | ------ | ----------- |
| 2026-11-14 | The service worker only answers downloaded lesson files. The host page itself is not cached. | Reloading the host page while offline fails unless the host caches its own page. Only lesson files requested by an already-open page are proven to work offline. | Decide whether the worker should also cache the host page shell |
| 2026-11-14 | Host sites must serve `savanna-sw.js` from their own origin. | Without it, downloads are saved but offline playback is not set up. The player says so. | Documented in `docs/integration.md` |
