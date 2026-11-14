import type { TranscriptSegment } from '@savanna/contracts';
import { LitElement, html } from 'lit';

export const TRANSCRIPT_TAG = 'savanna-transcript';

/** Searchable, synchronized transcript. Clicking a segment asks the player to seek. */
export class TranscriptPanel extends LitElement {
  static override properties = {
    segments: { attribute: false },
    activeIndex: { type: Number, attribute: 'active-index' },
  };

  declare segments: TranscriptSegment[];
  declare activeIndex: number;

  constructor() {
    super();
    this.segments = [];
    this.activeIndex = -1;
  }

  override render() {
    return html`<section aria-label="Transcript"></section>`;
  }
}

if (!customElements.get(TRANSCRIPT_TAG)) {
  customElements.define(TRANSCRIPT_TAG, TranscriptPanel);
}
