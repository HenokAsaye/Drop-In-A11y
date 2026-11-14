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
| `lang`             | No       | Interface language for player labels            |

| Event                   | Detail                    |
| ----------------------- | ------------------------- |
| `savanna-status-change` | `{ status }` — `idle`, `loading`, `ready`, `empty`, `error` |
| `savanna-error`         | `{ message, cause? }`     |

## Requirements for the host

- Add the host origin to the API's `SAVANNA_CORS_ORIGINS`.
- Media storage must allow CORS and HTTP range requests.
- Use HTTPS in production.
- **Offline mode:** serve `savanna-sw.js` from your own origin (service workers are same-origin
  only). Final approach is an open question in `docs/architecture.md`.
