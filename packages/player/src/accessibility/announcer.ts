/** Polite live region used to announce state changes (loading, errors, caption language) to screen readers. */
export class Announcer {
  constructor(protected readonly region: HTMLElement) {}

  announce(_message: string): void {
    throw new Error('Not implemented: Announcer.announce');
  }
}
