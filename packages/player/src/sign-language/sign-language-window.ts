import { LitElement, html } from 'lit';

export const SIGN_LANGUAGE_TAG = 'savanna-sign-language';

/** Movable, resizable Ethiopian Sign Language interpreter window (prerecorded, reviewed footage). */
export class SignLanguageWindow extends LitElement {
  static override properties = {
    src: { type: String },
    open: { type: Boolean, reflect: true },
  };

  declare src: string;
  declare open: boolean;

  constructor() {
    super();
    this.src = '';
    this.open = false;
  }

  override render() {
    return html`<section
      aria-label="Ethiopian Sign Language interpreter"
      ?hidden=${!this.open}
    ></section>`;
  }
}

if (!customElements.get(SIGN_LANGUAGE_TAG)) {
  customElements.define(SIGN_LANGUAGE_TAG, SignLanguageWindow);
}
