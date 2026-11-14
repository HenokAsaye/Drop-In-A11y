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
| `lang`             | No       | Interface language for player labels            |

| Event                   | Detail                    |
| ----------------------- | ------------------------- |
| `savanna-status-change` | `{ status }` — `idle`, `loading`, `ready`, `empty`, `error` |
| `savanna-error`         | `{ message, cause? }`     |

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
