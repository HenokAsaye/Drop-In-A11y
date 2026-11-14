import { PLAYER_TAG, type PlayerStatus } from '@savanna/contracts';
import { LitElement, css, html } from 'lit';

/**
 * <savanna-player lesson-id="..." api-base="..."> — the single entry point host websites embed.
 * Composes the media, captions, transcript, sign-language, audio-description and offline features.
 */
export class SavannaPlayer extends LitElement {
  static override properties = {
    lessonId: { type: String, attribute: 'lesson-id', reflect: true },
    apiBase: { type: String, attribute: 'api-base', reflect: true },
    captionLanguage: { type: String, attribute: 'caption-language' },
    status: { state: true },
  };

  static override styles = css`
    :host {
      display: block;
      font: inherit;
      color: inherit;
    }
    :host([hidden]) {
      display: none;
    }
  `;

  declare lessonId: string;
  declare apiBase: string;
  declare captionLanguage: string;
  declare status: PlayerStatus;

  constructor() {
    super();
    this.lessonId = '';
    this.apiBase = '';
    this.captionLanguage = 'en';
    this.status = 'idle';
  }

  override render() {
    return html`
      <section aria-label="Lesson player">
        <p role="status">${this.status}</p>
      </section>
    `;
  }
}

if (!customElements.get(PLAYER_TAG)) {
  customElements.define(PLAYER_TAG, SavannaPlayer);
}

declare global {
  interface HTMLElementTagNameMap {
    'savanna-player': SavannaPlayer;
  }
}
