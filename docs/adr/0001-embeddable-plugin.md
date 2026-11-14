# ADR 0001 — Deliver an embeddable Web Component, not a platform

- **Status:** Accepted
- **Date:** 2026-11-14

## Context

Institutions already run learning websites built with React, Angular, Vue or plain HTML. They need
accessible media features without migrating platforms or adopting our frontend framework.

## Decision

- Ship one Lit-based custom element, `<savanna-player>`, compiled into a single script with Lit
  bundled in.
- Render inside Shadow DOM to isolate styles; accessibility (semantics, focus, keyboard, screen
  readers) is still implemented and tested deliberately.
- A FastAPI service provides metadata and URLs only; media is served from object storage.
- The demo app exists only to prove integration.

## Consequences

- Host integration is a script tag and an element, with no build step.
- The element's attributes, events and the API schema are public contracts; changes must be
  versioned and are guarded by the contracts package and CI.
- Offline support has origin constraints (see `docs/architecture.md`, open questions).
