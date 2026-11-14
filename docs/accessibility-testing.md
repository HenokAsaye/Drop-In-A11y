# Accessibility testing

Target: WCAG 2.2 AA. Shadow DOM isolates styles but does **not** make a component accessible;
semantics, keyboard behaviour, focus management and screen-reader output are built and tested
deliberately.

## Automated

- **eslint-plugin-lit-a11y** lints every Lit template (`pnpm lint`).
- **axe-core** runs in Playwright against the demo page on desktop and mobile viewports
  (`pnpm test:e2e`). The build fails on any `critical` or `serious` violation.
- Component tests assert roles, accessible names and keyboard behaviour.

## Manual (required before the demo)

Follow [testing/manual-test-record.md](testing/manual-test-record.md) for:

1. **Keyboard only.** Every control is reachable and operable; focus is always visible; no traps;
   shortcuts never fire while typing.
2. **NVDA** (Windows, Firefox/Chrome) and **TalkBack** (Android). Controls announce name, role
   and state; status changes are announced through a polite live region.
3. **200% zoom** and narrow (320 px) viewport. No loss of content or functionality.
4. **Sound off.** Captions, transcript and sign language convey all spoken content.
5. **Offline.** Downloaded lesson works after disconnecting.
6. **Documents.** HTML: heading hierarchy, landmarks, descriptive links, table headers, alt text,
   `lang`. PDF: tagged, correct reading order and language (check with PAC 2024 + NVDA). Alt text
   alone does not make a PDF accessible.

## Implementation rules

- Native `<button>`, `<input type="range">`, `<select>` over ARIA-decorated `<div>`s.
- Every control has an accessible name; icon-only buttons use visually hidden text.
- Never convey state by color alone (pair with text or icon + label).
- Respect `prefers-reduced-motion` and `prefers-contrast`.
- Set `lang="am"` on Amharic content so screen readers switch voices.
- Record results and known limitations honestly.
