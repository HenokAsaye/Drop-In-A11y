import { API_VERSION_PREFIX, type CertificateVerification } from '@savanna/contracts';
import { LitElement, css, html } from 'lit';

export const CERTIFICATE_LINK_TAG = 'savanna-certificate-link';

type VerificationOutcome = 'pending' | 'verified' | 'not-valid' | 'unavailable';

/**
 * Link to a certificate verification result. Only a response from the verify endpoint counts as
 * proof; an ordinary URL is never presented as a verified credential.
 */
export class CertificateLink extends LitElement {
  static override properties = {
    certificateId: { type: String, attribute: 'certificate-id' },
    apiBase: { type: String, attribute: 'api-base' },
    verification: { state: true },
    outcome: { state: true },
  };

  static override styles = css`
    :host {
      display: block;
      max-width: 100%;
      min-width: 0;
      color: inherit;
      font: inherit;
      line-height: 1.5;
    }

    p {
      margin: 0;
      min-width: 0;
      overflow-wrap: anywhere;
    }
  `;

  declare certificateId: string;
  declare apiBase: string;
  declare verification: CertificateVerification | undefined;
  declare outcome: VerificationOutcome;

  private requestSerial = 0;
  private activeKey = '';

  constructor() {
    super();
    this.certificateId = '';
    this.apiBase = '';
    this.verification = undefined;
    this.outcome = 'pending';
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    this.requestSerial += 1;
    this.activeKey = '';
    super.disconnectedCallback();
  }

  override willUpdate(): void {
    if (!this.isConnected) return;
    const certificateId = this.certificateId.trim();
    const apiBase = this.apiBase.trim();
    if (certificateId === '' || apiBase === '') {
      this.requestSerial += 1;
      this.activeKey = '';
      this.verification = undefined;
      this.outcome = 'unavailable';
      return;
    }

    const url = verificationUrl(apiBase, certificateId);
    if (url === undefined) {
      this.requestSerial += 1;
      this.activeKey = '';
      this.verification = undefined;
      this.outcome = 'unavailable';
      return;
    }

    const key = `${apiBase}\n${certificateId}`;
    if (key === this.activeKey) return;
    this.activeKey = key;
    this.verification = undefined;
    this.outcome = 'pending';
    const serial = ++this.requestSerial;
    void this.loadVerification(url, serial);
  }

  override render() {
    // Keep the status text free of template whitespace so the live region announces the result.
    // prettier-ignore
    return html`<p role="status" aria-live="polite" aria-atomic="true">${labelFor(this.outcome)}</p>`;
  }

  private async loadVerification(url: string, serial: number): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
      });
      if (!this.isCurrent(serial)) return;
      if (!response.ok) {
        this.finish(serial, 'unavailable', undefined);
        return;
      }
      const body: unknown = await response.json();
      if (!this.isCurrent(serial)) return;
      const outcome = outcomeOf(body);
      this.finish(
        serial,
        outcome,
        outcome === 'unavailable' ? undefined : (body as CertificateVerification),
      );
    } catch {
      if (!this.isCurrent(serial)) return;
      this.finish(serial, 'unavailable', undefined);
    }
  }

  private finish(
    serial: number,
    outcome: VerificationOutcome,
    verification: CertificateVerification | undefined,
  ): void {
    if (!this.isCurrent(serial)) return;
    this.verification = verification;
    this.outcome = outcome;
  }

  private isCurrent(serial: number): boolean {
    return this.isConnected && serial === this.requestSerial;
  }
}

function labelFor(outcome: VerificationOutcome): string {
  switch (outcome) {
    case 'verified':
      return 'Verified';
    case 'not-valid':
      return 'Not valid';
    case 'unavailable':
      return 'Verification unavailable';
    default:
      return '';
  }
}

function outcomeOf(body: unknown): VerificationOutcome {
  if (typeof body !== 'object' || body === null) return 'unavailable';
  const record = body as Record<string, unknown>;
  if (record.valid === true && record.status === 'valid') return 'verified';
  if (record.valid === false && record.status === 'revoked') return 'not-valid';
  return 'unavailable';
}

function verificationUrl(apiBase: string, certificateId: string): string | undefined {
  let base: URL;
  try {
    base = new URL(apiBase);
  } catch {
    return undefined;
  }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') return undefined;
  const prefix = base.href.endsWith('/') ? base.href : `${base.href}/`;
  const path = `${API_VERSION_PREFIX}/certificates/${encodeURIComponent(certificateId)}/verify`;
  return new URL(path.replace(/^\/+/, ''), prefix).href;
}

if (!customElements.get(CERTIFICATE_LINK_TAG)) {
  customElements.define(CERTIFICATE_LINK_TAG, CertificateLink);
}

declare global {
  interface HTMLElementTagNameMap {
    'savanna-certificate-link': CertificateLink;
  }
}
