# Contributing

## Workflow

1. Branch from `main`: `feat/<area>-<short-name>` or `fix/<short-name>`.
2. Keep pull requests small and tied to one spec section.
3. Fill in the PR template, including the accessibility checklist.
4. CI must be green; one review is required to merge.
5. Merging to `main` triggers CD.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
(`feat(player): …`, `fix(api): …`, `test(captions): …`, `docs: …`, `ci: …`).

## Ownership (spec section 10)

| Area | Owner | Paths |
| ---- | ----- | ----- |
| Lit player, video controls, plugin integration | Member 1 | `packages/player/src/components`, `media`, `apps/demo` |
| Accessibility, captions, transcript, sign language | Member 2 | `packages/player/src/accessibility`, `captions`, `transcript`, `sign-language`, `audio-description` |
| FastAPI, lesson API, media resources, OpenAPI | Member 3 | `apps/api`, `packages/contracts`, `assets` |
| Offline, documents, career gateway, integration testing | Member 4 | `packages/offline`, `packages/career`, `apps/demo/e2e` |

Agree on changes to `packages/contracts` (element contract and API schema) **before** parallel work.

## Definition of done for a feature

- Behaviour implemented per the spec section.
- Pending tests (`it.todo`, `test.fixme`, `xfail`) for that feature replaced by passing tests.
- Keyboard and screen-reader checks done, or recorded as pending in
  `docs/testing/manual-test-record.md`.
- Docs updated (`docs/api.md`, `docs/integration.md`) if a contract changed.

## Local checks before pushing

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm test
pnpm api:lint && pnpm api:test
```
