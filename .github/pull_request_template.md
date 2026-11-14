## What and why

<!-- One or two sentences. Link the spec section (e.g. "Spec 4.2 captions"). -->

## How it was tested

- [ ] Unit tests added or updated (`pnpm test`, `uv run pytest`)
- [ ] e2e / axe-core still passing (`pnpm test:e2e`)

## Accessibility checklist (spec 11.2)

- [ ] Every new control works with a keyboard alone and has a visible focus indicator
- [ ] Every new control has a meaningful accessible name
- [ ] No meaning is conveyed by color or sound alone
- [ ] Checked at 200% zoom
- [ ] Screen-reader check done (NVDA / TalkBack / VoiceOver) or noted as pending in `docs/testing/manual-test-record.md`

## Contract changes

- [ ] No change to the `<savanna-player>` attributes/events or API response shape
- [ ] Or: contract changed, `pnpm api:openapi && pnpm contracts:generate` run and committed
