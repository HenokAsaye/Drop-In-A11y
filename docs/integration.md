# Integrating BridgePlayer into a host website

Host websites do **not** install Lit or any framework. Add the script once and place the element.

## Plain HTML

```html
<script src="https://cdn.example.com/bridge-player.js" defer></script>

<savanna-player lesson-id="networking-101" api-base="https://api.example.com"></savanna-player>
```

## React

```jsx
// index.html already includes the script tag.
export function Lesson() {
  return <savanna-player lesson-id="networking-101" api-base="https://api.example.com" />;
}
```

## Vue

Tell the compiler the tag is a custom element (`compilerOptions.isCustomElement = (tag) =>
tag.startsWith('savanna-')`), then use `<savanna-player lesson-id="…" api-base="…" />`.

## Angular

Add `CUSTOM_ELEMENTS_SCHEMA` to the component or module `schemas`, then use the element in the
template.

## Element contract

Defined in `packages/contracts/src/element.ts`.

| Attribute          | Required | Description                                     |
| ------------------ | -------- | ----------------------------------------------- |
| `lesson-id`        | Yes      | Lesson identifier, e.g. `networking-101`        |
| `api-base`         | Yes      | Base URL of the BridgePlayer API                |
| `caption-language` | No       | Initial caption language (`en`, `am`)           |
| `sw-url`           | No       | URL of `savanna-sw.js` on your own origin (default `/savanna-sw.js`) |
| `lang`             | No       | Interface language for labels. `en` and `am` (including `am-ET`) are supported. Any other value uses English. This does not change caption or transcript language. |

| Event                   | Detail                    |
| ----------------------- | ------------------------- |
| `savanna-status-change` | `{ status }` — `idle`, `loading`, `ready`, `empty`, `error` |
| `savanna-error`         | `{ message, cause? }`     |
| `savanna-lesson-ready`  | `{ lessonId, currentTime }` — video can play; a timestamp link was already applied |
| `savanna-progress`      | `{ lessonId, currentTime }` — playback moved, or the learner seeked |
| `savanna-completed`     | `{ lessonId, currentTime }` — the video reached the end |

The player remembers each lesson's position, plus speed and volume, in `localStorage` on this device. It does not store progress on a server. Listen to the three playback events if the host site wants its own record. A copied lesson link uses `savanna-t` (seconds) and `savanna-lesson` (the lesson id). `#t=` and `?t=` open at that time when `savanna-lesson` is absent or matches.

When the learner has not saved caption settings, high contrast starts from the system `forced-colors: active` mode and is not written to storage. A caption choice the learner makes is saved and kept on the next visit, including when it matches the system mode. The player and the sign-language window follow `prefers-reduced-motion` and do not add their own animation.

## Host colors

Style the player from the host page with these CSS parts:

| Part         | What it is                                                                 |
| ------------ | -------------------------------------------------------------------------- |
| `toolbar`    | The media control bar                                                      |
| `documents`  | The lesson document list                                                   |
| `focus-ring` | Focusable controls, including controls inside nested player components     |

`focus-ring` on the transcript and sign-language window is re-exported with `exportparts="focus-ring"`, so one host rule reaches those nested controls.

```css
savanna-player::part(toolbar) {
  background: #111827;
}

savanna-player::part(documents) {
  border-color: #2563eb;
}

savanna-player::part(focus-ring):focus-visible {
  outline: 3px solid #f59e0b;
  outline-offset: 2px;
}
```

## Requirements for the host

- Add the host origin to the API's `SAVANNA_CORS_ORIGINS`.
- Media storage must allow CORS and HTTP range requests.
- Use HTTPS in production.
- **Offline mode:** serve `savanna-sw.js` from your own origin. Service workers are same-origin
  only, so a worker loaded from the plugin's CDN cannot control your pages. Copy the file from the
  plugin release into your site's public folder (for example `/savanna-sw.js`). If it lives
  elsewhere, point the player at it with `sw-url`. The player registers the worker when a learner
  first downloads a lesson. If the file is missing, downloads still save, the player tells the
  learner that offline playback is not set up, and the lesson will not open offline. The worker
  only answers requests for downloaded lesson files; every other request goes to the network.
