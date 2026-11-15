import { API_VERSION_PREFIX, type CertificateVerification } from '@savanna/contracts';
import { LitElement, css, html, nothing } from 'lit';

export const CERTIFICATE_LINK_TAG = 'savanna-certificate-link';

export type VerificationOutcome = 'pending' | 'valid' | 'revoked' | 'not-found';

export interface VerificationDescription {
  sentence: string;
  accessibleName: string;
}

export function describeVerification(
  outcome: VerificationOutcome,
  verification?: CertificateVerification,
): VerificationDescription {
  if (outcome === 'pending') {
    return { sentence: '', accessibleName: '' };
  }

  const raw = verification as Record<string, unknown> | undefined;
  const holder =
    verification?.holderName?.trim() ||
    (typeof raw?.['holder_name'] === 'string' ? raw['holder_name'].trim() : '');
  const course =
    verification?.courseTitle?.trim() ||
    (typeof raw?.['course_title'] === 'string' ? raw['course_title'].trim() : '');
  const issuer = verification?.issuer?.trim() || '';

  const details =
    holder !== '' && course !== '' && issuer !== ''
      ? ` for ${holder} in ${course} issued by ${issuer}`
      : holder !== '' && course !== ''
        ? ` for ${holder} in ${course}`
        : holder !== ''
          ? ` for ${holder}`
          : '';

  if (outcome === 'valid') {
    const sentence =
      details !== '' ? `Valid: Certificate${details}.` : 'Valid: Certificate is valid.';
    return { sentence, accessibleName: sentence };
  }

  if (outcome === 'revoked') {
    const sentence =
      details !== '' ? `Revoked: Certificate${details}.` : 'Revoked: Certificate has been revoked.';
    return { sentence, accessibleName: sentence };
  }

  const sentence = 'Not found: Certificate was not found.';
  return { sentence, accessibleName: sentence };
}

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
      this.outcome = 'not-found';
      return;
    }

    const url = verificationUrl(apiBase, certificateId);
    if (url === undefined) {
      this.requestSerial += 1;
      this.activeKey = '';
      this.verification = undefined;
      this.outcome = 'not-found';
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
    const { sentence, accessibleName } = describeVerification(this.outcome, this.verification);
    // Keep the status text free of template whitespace so the live region announces the result.
    // prettier-ignore
    return html`<p role="status" aria-live="polite" aria-atomic="true" aria-label=${accessibleName || nothing}>${sentence}</p>`;
  }

  private async loadVerification(url: string, serial: number): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
      });
      if (!this.isCurrent(serial)) return;
      if (!response.ok) {
        this.finish(serial, 'not-found', undefined);
        return;
      }
      const body: unknown = await response.json();
      if (!this.isCurrent(serial)) return;
      const outcome = outcomeOf(body);
      this.finish(
        serial,
        outcome,
        outcome === 'not-found' ? undefined : (body as CertificateVerification),
      );
    } catch {
      if (!this.isCurrent(serial)) return;
      this.finish(serial, 'not-found', undefined);
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

function outcomeOf(body: unknown): 'valid' | 'revoked' | 'not-found' {
  if (typeof body !== 'object' || body === null) return 'not-found';
  const record = body as Record<string, unknown>;
  if (record.valid === true && record.status === 'valid') return 'valid';
  if (record.valid === false && record.status === 'revoked') return 'revoked';
  return 'not-found';
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
