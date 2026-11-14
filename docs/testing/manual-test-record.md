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

## Known limitations

| Date | Limitation | Impact | Planned fix |
| ---- | ---------- | ------ | ----------- |
|      |            |        |             |
