import type { Career } from '@savanna/contracts';
import { LitElement, html } from 'lit';

export const JOB_CARD_TAG = 'savanna-job-card';

/**
 * Accessible job card: title, organization, description, application link, audio summary,
 * interview accommodations and certificate verification link. Must work at 200% zoom.
 */
export class JobCard extends LitElement {
  static override properties = {
    job: { attribute: false },
    headingLevel: { type: Number, attribute: 'heading-level' },
  };

  declare job: Career | undefined;
  declare headingLevel: number;

  constructor() {
    super();
    this.job = undefined;
    this.headingLevel = 3;
  }

  override render() {
    return html`<article aria-label=${this.job?.title ?? 'Job opportunity'}></article>`;
  }
}

if (!customElements.get(JOB_CARD_TAG)) {
  customElements.define(JOB_CARD_TAG, JobCard);
}

declare global {
  interface HTMLElementTagNameMap {
    'savanna-job-card': JobCard;
  }
}
