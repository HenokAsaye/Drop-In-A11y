# Savanna BridgePlayer

An embeddable accessibility plugin that adds accessible video, English and Amharic captions,
Ethiopian Sign Language interpretation, audio description, synchronized transcripts, offline
resources, accessible documents and career cards to **existing** learning websites.

```html
<script src="https://cdn.example.com/bridge-player.js" defer></script>
<savanna-player lesson-id="networking-101" api-base="https://api.example.com"></savanna-player>
```

> **Status: skeleton.** The architecture, contracts, tooling, CI/CD and test harness are in place.
> Feature code is stubbed (`Not implemented`) and API endpoints return `501` until implemented.
> Pending behaviour is tracked as `it.todo` / `test.fixme` / strict `xfail` tests.

## Architecture

```mermaid
flowchart TD
  host["Existing learning website<br/>(React, Angular, Vue or plain HTML)"]
  subgraph plugin["bridge-player.js (Lit bundled in)"]
    player["&lt;savanna-player&gt;"]
    media["media · captions · transcript<br/>sign-language · audio-description<br/>accessibility"]
    offline["offline<br/>(service worker, Cache API, IndexedDB)"]
    career["career<br/>(job cards, certificate links)"]
  end
  api["FastAPI · /api/v1<br/>lessons · careers · certificates"]
  db[(PostgreSQL<br/>metadata)]
  storage[("Object storage / CDN<br/>video, audio, VTT, JSON, HTML, PDF")]

  host -- script tag --> player
  player --- media & offline & career
  player -- metadata --> api
  api --> db
  player -- media URLs --> storage
```

The API returns **metadata and URLs**; browsers fetch media straight from storage. See
[`docs/architecture.md`](docs/architecture.md).

## Repository layout

```
apps/
  api/            FastAPI service (routes → services → repositories → models), Alembic, Dockerfile
  demo/           Sample host website + Playwright/axe-core e2e tests (not a learning platform)
packages/
  contracts/      Shared API types generated from OpenAPI + <savanna-player> element contract
  player/         <savanna-player> Web Component; builds the embeddable bundle
  offline/        Service worker, download manager, IndexedDB storage
  career/         <savanna-job-card>, <savanna-certificate-link>
assets/           Lesson media conventions (large files live in object storage, not git)
docs/             Installation, integration, API, architecture, accessibility and test docs
infra/            Local media server config
.github/          CI and CD workflows, Dependabot, PR template
```

## Getting started

Requirements: Node 24 (`.nvmrc`), pnpm 11, [uv](https://docs.astral.sh/uv/), Docker.

```bash
pnpm install
(cd apps/api && uv sync && cp .env.example .env)

docker compose up -d db media   # PostgreSQL on :5432, media on :8080
pnpm api:dev                    # API on :8000, docs at /docs
pnpm dev                        # builds the plugin, demo on :5173
```

Full instructions: [`docs/installation.md`](docs/installation.md).

## Common commands

| Command                                    | What it does                                        |
| ------------------------------------------ | --------------------------------------------------- |
| `pnpm build`                               | Build plugin bundle, service worker and demo        |
| `pnpm lint` / `pnpm typecheck`             | ESLint (incl. lit-a11y) / TypeScript                |
| `pnpm test` / `pnpm test:coverage`         | Vitest unit tests for all packages                  |
| `pnpm test:e2e`                            | Playwright + axe-core against the demo (build first)|
| `pnpm api:lint` / `pnpm api:test`          | Ruff + mypy / pytest for the API                    |
| `pnpm api:openapi && pnpm contracts:generate` | Regenerate the shared TypeScript contract        |

## CI/CD

- **CI** (`.github/workflows/ci.yml`, every pull request): web lint/typecheck/unit tests/build,
  Playwright + axe-core e2e, API lint/mypy/unit + PostgreSQL integration tests + migrations,
  OpenAPI ↔ TypeScript contract drift check, API Docker build.
- **CD** (`.github/workflows/cd.yml`, push to `main` and `v*` tags): runs CI, then publishes the
  API image to GHCR, attaches the plugin bundle to GitHub Releases on tags, and (opt-in via
  `DEPLOY_DEMO_PAGES=true`) deploys the demo site to GitHub Pages.

## Documentation

- [Architecture](docs/architecture.md) · [ADR 0001](docs/adr/0001-embeddable-plugin.md)
- [Installation](docs/installation.md) · [Integration](docs/integration.md) · [API](docs/api.md)
- [Accessibility testing](docs/accessibility-testing.md)
- Testing: [strategy](docs/testing/test-strategy.md) ·
  [acceptance checklist](docs/testing/acceptance-checklist.md) ·
  [manual test record](docs/testing/manual-test-record.md)
- [Contributing](CONTRIBUTING.md)

## Scope

We are building one embeddable plugin, one supporting REST API, one sample host page and one
prepared demonstration lesson. We are **not** building an LMS, a content-management dashboard, a
job marketplace, automatic sign-language generation, or production ASR/translation.
