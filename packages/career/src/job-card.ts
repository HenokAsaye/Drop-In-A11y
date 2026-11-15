import { API_VERSION_PREFIX, webUrl, type Career } from '@savanna/contracts';
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';

import './certificate';

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

  static override styles = css`
    :host {
      display: block;
      max-width: 100%;
      min-width: 0;
      color: inherit;
      font: inherit;
      line-height: 1.5;
    }

    article {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      min-width: 0;
      max-width: 100%;
    }

    h1,
    h2,
    h3,
    h4,
    h5,
    h6,
    p {
      margin: 0;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    a {
      display: inline-flex;
      align-items: center;
      min-height: 2.5rem;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    audio {
      display: block;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      min-height: 2.5rem;
    }

    a:focus-visible,
    audio:focus-visible {
      outline: 2px solid #38bdf8;
      outline-offset: 2px;
    }
  `;

  declare job: Career | undefined;
  declare headingLevel: number;

  constructor() {
    super();
    this.job = undefined;
    this.headingLevel = 3;
  }

  override render() {
    const job = this.job;
    if (job === undefined) return html`<article aria-label="Job opportunity"></article>`;

    const title = present(job.title);
    const organization = present(job.organization);
    const description = present(job.description);
    const accommodations = present(job.accommodations);
    const applicationUrl = webUrl(job.applicationUrl, document.baseURI);
    const audioSummaryUrl = webUrl(job.audioSummaryUrl, document.baseURI);
    const certificate = certificateTarget(job.certificateVerificationUrl);

    return html`
      <article>
        ${renderTitle(this.headingLevel, title)}
        ${organization === '' ? nothing : html`<p>${organization}</p>`}
        ${description === '' ? nothing : html`<p id="job-description">${description}</p>`}
        ${accommodations === '' ? nothing : html`<p>${accommodations}</p>`}
        ${applicationUrl === null ? nothing : html`<a href=${applicationUrl}>${applyName(title, organization)}</a>`}
        ${audioSummaryUrl === null ? nothing : renderAudio(audioSummaryUrl, description, title)}
        ${
          certificate === undefined
            ? nothing
            : html`<savanna-certificate-link
                certificate-id=${certificate.id}
                api-base=${certificate.apiBase}
              ></savanna-certificate-link>`
        }
      </article>
    `;
  }
}

function present(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function applyName(title: string, organization: string): string {
  const role = title === '' ? 'this job' : title;
  return organization === '' ? `Apply for ${role}` : `Apply for ${role} at ${organization}`;
}

function renderTitle(level: number, title: string): TemplateResult {
  switch (level) {
    case 1:
      return html`<h1>${title}</h1>`;
    case 2:
      return html`<h2>${title}</h2>`;
    case 4:
      return html`<h4>${title}</h4>`;
    case 5:
      return html`<h5>${title}</h5>`;
    case 6:
      return html`<h6>${title}</h6>`;
    default:
      return html`<h3>${title}</h3>`;
  }
}

/** Id and API base from an absolute `/api/v1/certificates/{id}/verify` URL. */
function certificateTarget(
  value: string | null | undefined,
): { id: string; apiBase: string } | undefined {
  const raw = present(value);
  if (raw === '') return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
  if (url.search !== '' || url.hash !== '') return undefined;

  const pathname = url.pathname.replace(/\/$/, '');
  const marker = `${API_VERSION_PREFIX}/certificates/`;
  const start = pathname.lastIndexOf(marker);
  if (start < 0) return undefined;
  const rest = pathname.slice(start + marker.length);
  const slash = rest.indexOf('/');
  if (slash <= 0 || rest.slice(slash + 1) !== 'verify') return undefined;

  let id: string;
  try {
    id = decodeURIComponent(rest.slice(0, slash)).trim();
  } catch {
    return undefined;
  }
  if (id === '' || id.includes('/')) return undefined;
  return { id, apiBase: `${url.origin}${pathname.slice(0, start)}` };
}

function renderAudio(url: string, description: string, title: string): TemplateResult {
  if (description !== '') {
    return html`<audio controls src=${url} aria-labelledby="job-description">
      ${description}
    </audio>`;
  }
  const name = title === '' ? 'Audio summary' : `Audio summary of ${title}`;
  return html`<audio controls src=${url} aria-label=${name}></audio>`;
}

if (!customElements.get(JOB_CARD_TAG)) {
  customElements.define(JOB_CARD_TAG, JobCard);
}

declare global {
  interface HTMLElementTagNameMap {
    'savanna-job-card': JobCard;
  }
}
