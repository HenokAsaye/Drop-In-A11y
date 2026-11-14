/** Writes status text into a live region so screen readers notice the change. */
export class Announcer {
  constructor(protected readonly region: HTMLElement) {
    if (!this.region.hasAttribute('aria-live') && !this.region.hasAttribute('role')) {
      this.region.setAttribute('aria-live', 'polite');
    }
    if (!this.region.hasAttribute('aria-atomic')) {
      this.region.setAttribute('aria-atomic', 'true');
    }
  }

  announce(message: string): void {
    if (this.region.textContent === message) return;
    this.region.textContent = message;
  }
}
