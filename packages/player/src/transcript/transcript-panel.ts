import type { TranscriptSegment } from '@savanna/contracts';
import { LitElement, css, html, nothing, type PropertyValues } from 'lit';

import { interfaceText } from '../labels';
import { REDUCED_MOTION_QUERY, mediaMatches, watchMedia } from '../media-preferences';
import { findActiveSegment, searchSegments } from './transcript-sync';

export const TRANSCRIPT_TAG = 'savanna-transcript';
export const TRANSCRIPT_SCROLL_IDLE_MS = 1500;

export interface TranscriptSeekDetail {
  seconds: number;
}

export interface TranscriptLanguageDetail {
  language: 'en' | 'am';
}

/** Searchable, synchronized transcript. Clicking a segment asks the player to seek. */
export class TranscriptPanel extends LitElement {
  static override properties = {
    segments: { attribute: false },
    currentTime: { type: Number, attribute: 'current-time' },
    language: { type: String },
    interfaceLang: { type: String, attribute: 'interface-lang' },
    reducedMotion: { type: Boolean, reflect: true, attribute: 'reduced-motion' },
    query: { state: true },
    activeIndex: { state: true },
  };

  static override styles = css`
    :host {
      display: block;
      color: inherit;
      font: inherit;
      line-height: 1.5;
    }

    section {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 0.75rem;
    }

    .languages,
    .segments {
      display: flex;
      gap: 0.5rem;
    }

    .languages {
      flex-wrap: wrap;
    }

    .segments {
      flex-direction: column;
      max-height: 16rem;
      overflow: auto;
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    input,
    button {
      font: inherit;
      color: inherit;
    }

    button {
      min-height: 2.5rem;
      padding: 0.5rem 0.75rem;
      text-align: start;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 4px;
      cursor: pointer;
    }

    button:hover {
      background: rgba(15, 23, 42, 0.06);
    }

    button:focus-visible,
    input:focus-visible {
      outline: 2px solid #38bdf8;
      outline-offset: 2px;
    }

    button[aria-current='true'] {
      background: #0f172a;
      color: #f8fafc;
    }

    :host([reduced-motion]),
    :host([reduced-motion]) * {
      scroll-behavior: auto !important;
      transition: none !important;
      animation: none !important;
    }
  `;

  declare segments: TranscriptSegment[];
  declare currentTime: number;
  declare language: string;
  declare interfaceLang: string;
  declare reducedMotion: boolean;
  declare query: string;
  declare activeIndex: number;

  private unwatchMotion: (() => void) | null = null;

  private scrollPaused = false;
  private scrollIdleTimer: ReturnType<typeof setTimeout> | null = null;
  private programmaticScroll = false;
  private lastScrolledIndex = -2;

  constructor() {
    super();
    this.segments = [];
    this.currentTime = 0;
    this.language = 'en';
    this.interfaceLang = '';
    this.reducedMotion = false;
    this.query = '';
    this.activeIndex = -1;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.reducedMotion = mediaMatches(REDUCED_MOTION_QUERY);
    this.unwatchMotion = watchMedia(REDUCED_MOTION_QUERY, (matches) => {
      this.reducedMotion = matches;
    });
  }

  override disconnectedCallback(): void {
    this.unwatchMotion?.();
    this.unwatchMotion = null;
    this.clearScrollIdle();
    super.disconnectedCallback();
  }

  override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('segments') && !changed.has('currentTime')) return;
    this.activeIndex = findActiveSegment(this.segments, this.currentTime);
  }

  override updated(changed: PropertyValues<this>): void {
    const searchCleared = changed.has('query') && this.query.trim() === '';
    if (changed.has('activeIndex') || searchCleared) this.scrollActiveIntoView();
  }

  override render() {
    const language = this.language === 'am' ? 'am' : 'en';
    const visible = this.visibleIndexes();
    return html`
      <section aria-label=${interfaceText(this.interfaceLang, 'transcript')}>
        <div
          class="languages"
          role="group"
          aria-label=${interfaceText(this.interfaceLang, 'transcriptLanguageGroup')}
        >
          <button
            type="button"
            part="focus-ring"
            aria-pressed=${language === 'en' ? 'true' : 'false'}
            @click=${() => this.chooseLanguage('en')}
          >
            ${interfaceText(this.interfaceLang, 'english')}
          </button>
          <button
            type="button"
            part="focus-ring"
            lang="am"
            aria-pressed=${language === 'am' ? 'true' : 'false'}
            @click=${() => this.chooseLanguage('am')}
          >
            አማርኛ
          </button>
        </div>
        <label for="transcript-search"
          >${interfaceText(this.interfaceLang, 'searchTranscript')}</label
        >
        <input
          id="transcript-search"
          part="focus-ring"
          type="search"
          .value=${this.query}
          @input=${this.onSearch}
        />
        <div class="segments" @scroll=${this.onManualScroll}>
          ${visible.map((index) => {
            const segment = this.segments[index];
            if (segment === undefined) return nothing;
            const active = index === this.activeIndex;
            return html`
              <button
                type="button"
                part="focus-ring"
                data-index=${index}
                lang=${language}
                aria-current=${active ? 'true' : nothing}
                @click=${() => this.choose(segment)}
              >
                ${segment.text}
              </button>
            `;
          })}
        </div>
      </section>
    `;
  }

  private visibleIndexes(): number[] {
    const query = this.query.trim();
    if (query === '') return this.segments.map((_, index) => index);
    return searchSegments(this.segments, query);
  }

  private chooseLanguage(language: 'en' | 'am'): void {
    this.dispatchEvent(
      new CustomEvent<TranscriptLanguageDetail>('savanna-transcript-language', {
        detail: { language },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onSearch(event: Event): void {
    const target = event.target;
    this.query = target instanceof HTMLInputElement ? target.value : '';
  }

  private onManualScroll(): void {
    if (this.programmaticScroll) return;
    this.scrollPaused = true;
    this.clearScrollIdle();
    this.scrollIdleTimer = setTimeout(() => {
      this.scrollIdleTimer = null;
      this.scrollPaused = false;
      this.scrollActiveIntoView();
    }, TRANSCRIPT_SCROLL_IDLE_MS);
  }

  private choose(segment: TranscriptSegment): void {
    this.scrollPaused = false;
    this.clearScrollIdle();
    this.dispatchEvent(
      new CustomEvent<TranscriptSeekDetail>('savanna-transcript-seek', {
        detail: { seconds: segment.start },
        bubbles: true,
        composed: true,
      }),
    );
    this.scrollActiveIntoView();
  }

  private scrollActiveIntoView(): void {
    if (this.scrollPaused || this.query.trim() !== '') return;
    if (this.activeIndex < 0) {
      this.lastScrolledIndex = -1;
      return;
    }
    if (this.activeIndex === this.lastScrolledIndex) return;
    const button = this.renderRoot.querySelector<HTMLElement>(`[data-index="${this.activeIndex}"]`);
    if (button === null || typeof button.scrollIntoView !== 'function') return;
    this.programmaticScroll = true;
    button.scrollIntoView({ block: 'nearest' });
    this.lastScrolledIndex = this.activeIndex;
    queueMicrotask(() => {
      this.programmaticScroll = false;
    });
  }

  private clearScrollIdle(): void {
    if (this.scrollIdleTimer === null) return;
    clearTimeout(this.scrollIdleTimer);
    this.scrollIdleTimer = null;
  }
}

if (!customElements.get(TRANSCRIPT_TAG)) {
  customElements.define(TRANSCRIPT_TAG, TranscriptPanel);
}
