import type { CertificateVerification } from '@savanna/contracts';
import { LitElement, html } from 'lit';

export const CERTIFICATE_LINK_TAG = 'savanna-certificate-link';

/**
 * Link to a certificate verification result. Only a response from the verify endpoint counts as
 * proof; an ordinary URL is never presented as a verified credential.
 */
export class CertificateLink extends LitElement {
  static override properties = {
    certificateId: { type: String, attribute: 'certificate-id' },
    apiBase: { type: String, attribute: 'api-base' },
    verification: { state: true },
  };

  declare certificateId: string;
  declare apiBase: string;
  declare verification: CertificateVerification | undefined;

  constructor() {
    super();
    this.certificateId = '';
    this.apiBase = '';
    this.verification = undefined;
  }

  override render() {
    return html`<span></span>`;
  }
}

if (!customElements.get(CERTIFICATE_LINK_TAG)) {
  customElements.define(CERTIFICATE_LINK_TAG, CertificateLink);
}

declare global {
  interface HTMLElementTagNameMap {
    'savanna-certificate-link': CertificateLink;
  }
}
