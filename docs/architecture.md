# Architecture

## Components

| Component        | Location                    | Responsibility                                                         |
| ---------------- | --------------------------- | ---------------------------------------------------------------------- |
| Embeddable player| `packages/player`           | `<savanna-player>` Web Component; composes every learner-facing feature |
| Offline          | `packages/offline`          | Service worker, Cache API downloads, IndexedDB index of lessons        |
| Career gateway   | `packages/career`           | Accessible job cards and certificate verification links               |
| Contracts        | `packages/contracts`        | TypeScript types generated from the API's OpenAPI + element contract  |
| API              | `apps/api`                  | Lesson, resource, career and certificate **metadata** (FastAPI)        |
| Database         | PostgreSQL                  | Lessons, captions, transcripts, documents, careers, certificates       |
| Media storage    | Object storage / CDN        | Video, audio, VTT, transcript JSON, HTML and PDF files                 |
| Demo             | `apps/demo`                 | Plain HTML host page proving script-tag integration                    |

`player`, `offline` and `career` are bundled into one file, `bridge-player.js` (IIFE for script
tags, ES module for bundlers). Lit is bundled in, so host websites install nothing.

## Request flow

1. Host page loads `bridge-player.js` and renders `<savanna-player lesson-id api-base>`.
2. The player calls `GET {api-base}/api/v1/lessons/{id}`.
3. The API reads metadata from PostgreSQL and returns absolute URLs built from the media base URL.
4. The browser streams media, captions and documents **directly from storage/CDN** (HTTP range
   requests), never through the API.
5. Offline downloads fetch the `/offline` package and store files in the Cache API.

## Backend layering

```
routes (HTTP, validation, OpenAPI)  →  services (use cases, URL building)
  →  repositories (SQLAlchemy queries)  →  models (tables)
schemas = the wire contract (camelCase JSON), separate from models
```

Dependencies are wired in `app/api/deps.py`, so each layer can be tested in isolation. Unimplemented
use cases raise `NotImplementedError`, which the API maps to `501 Not Implemented`.

## Contract-first integration

The spec requires agreeing on the custom-element contract and lesson schema before parallel work.

- **Element contract:** `packages/contracts/src/element.ts` (attributes, events, statuses).
- **API contract:** Pydantic schemas → `packages/contracts/openapi.json` →
  `packages/contracts/src/generated/api.ts`. CI fails if they drift.

## Scalability

- **Stateless API**: no session state, so it scales horizontally behind a load balancer; the
  container image is published to GHCR by CD.
- **Media never touches the app server**: large files are served by object storage + CDN, which
  scale independently and support range requests for seeking.
- **Cacheable metadata**: lesson responses are read-only and can be cached at the CDN/HTTP layer.
- **Versioned API** (`/api/v1`) and versioned offline caches (`savanna-lesson:<id>:<version>`).
- **Monorepo packages** with clear boundaries; new feature areas become new packages or folders
  without touching the host integration.
- **Async database access** (SQLAlchemy asyncio + asyncpg) with Alembic migrations.

## Decisions

- **Service worker origin (issue #16).** A service worker can only control pages on its own
  origin, so a CDN-hosted `savanna-sw.js` cannot work for host sites. Decision: host sites serve
  `savanna-sw.js` from their own origin (see `docs/integration.md`). The player registers it on
  the first download, and `sw-url` overrides the default `/savanna-sw.js`. Rejected: a
  BridgePlayer-hosted offline page, which needs a second hosted app and breaks the drop-in model.

## Open questions

- **Certificate verification format.** Plain verification page vs. W3C Verifiable Credentials.
- **Media hosting** for the demo (GitHub Pages size limits vs. object storage bucket).
