# Installation (development)

## Prerequisites

- Node.js 24 (see `.nvmrc`) and pnpm 11 (`corepack enable`)
- Python 3.14 via [uv](https://docs.astral.sh/uv/)
- Docker (PostgreSQL and the local media server)

## Setup

```bash
pnpm install
cd apps/api && uv sync && cp .env.example .env && cd ../..
docker compose up -d db media
```

## Run

```bash
pnpm api:dev   # http://localhost:8000 (OpenAPI docs at /docs)
pnpm dev       # builds packages, serves the demo at http://localhost:5173
```

Or run the whole backend in containers: `docker compose up --build`.

## Database migrations

```bash
cd apps/api
uv run alembic revision --autogenerate -m "describe change"
uv run alembic upgrade head
```

No migrations exist yet; the first one is created when the data model is implemented.

## Environment variables (API)

All prefixed with `SAVANNA_`; see `apps/api/.env.example`.

| Variable                 | Purpose                                              |
| ------------------------ | ---------------------------------------------------- |
| `SAVANNA_ENVIRONMENT`    | `development`, `test`, `staging` or `production`     |
| `SAVANNA_DATABASE_URL`   | `postgresql+asyncpg://…`                             |
| `SAVANNA_CORS_ORIGINS`   | Comma-separated host websites allowed to embed       |
| `SAVANNA_MEDIA_BASE_URL` | Public base URL of object storage / CDN              |
| `SAVANNA_PUBLIC_API_URL` | Public base URL of this API                          |
| `SAVANNA_LOG_LEVEL`      | Logging level                                        |

## Demo build variables

| Variable                | Purpose                                         |
| ----------------------- | ----------------------------------------------- |
| `VITE_SAVANNA_API_BASE` | API URL injected into the demo page             |
| `DEMO_BASE_PATH`        | Base path when hosted under a sub-path (Pages)  |
