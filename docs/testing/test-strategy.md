# Test strategy

Automated tools alone cannot prove WCAG 2.2 AA conformance. We combine automated layers with
recorded manual testing using real assistive technology.

## Layers

| Layer                 | Tool                         | Location                                 | Runs in CI |
| --------------------- | ---------------------------- | ---------------------------------------- | ---------- |
| Web unit / component  | Vitest + happy-dom           | `packages/*/test/*.test.ts`              | Yes        |
| API unit              | pytest + httpx ASGI client   | `apps/api/tests/unit/`                   | Yes        |
| API integration       | pytest + PostgreSQL 17       | `apps/api/tests/integration/` (`-m integration`) | Yes |
| Contract              | OpenAPI → TS drift check     | `packages/contracts/`                    | Yes        |
| End-to-end            | Playwright (desktop + mobile)| `apps/demo/e2e/`                         | Yes        |
| Automated a11y        | axe-core via Playwright      | `apps/demo/e2e/accessibility.spec.ts`    | Yes        |
| Static a11y lint      | eslint-plugin-lit-a11y       | all Lit templates                        | Yes        |
| Manual a11y           | Keyboard, NVDA, TalkBack, 200% zoom, sound off | [manual-test-record.md](manual-test-record.md) | No |

## Tracking pending work

The skeleton encodes the specification as pending tests so progress is visible in every test run:

- **Vitest:** `it.todo('…')` — listed as "todo" in the report.
- **Playwright:** `test.fixme('…')` — listed as skipped.
- **pytest:** `@pytest.mark.xfail(raises=NotImplementedError, strict=True)` — once the code is
  implemented the test passes, strict mode fails the run, and the marker must be removed. This keeps
  the spec tests honest.

When implementing a feature, turn its pending tests into real ones in the same pull request.

## Commands

```bash
pnpm test               # web unit tests
pnpm test:coverage      # with coverage (lcov in coverage/)
pnpm build && pnpm test:e2e   # e2e + axe (install browsers once: pnpm --filter @savanna/demo exec playwright install chromium)
pnpm api:test           # API unit tests
cd apps/api && uv run pytest -m integration   # needs PostgreSQL (docker compose up -d db)
```

## Quality gates (CI must be green to merge)

- Lint, format and typecheck pass (web and API).
- All unit, integration and e2e tests pass.
- axe-core reports **zero critical and serious** violations on the demo page.
- Generated contracts match the API schema.
- API container image builds.

## Coverage expectations

Coverage is reported, not gated, while the codebase is a skeleton. Once features land, aim for
≥ 80% line coverage on `packages/*/src` and `apps/api/app`, and add a CI threshold.
