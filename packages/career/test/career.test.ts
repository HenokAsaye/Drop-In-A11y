import type { Career } from '@savanna/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CertificateLink, JobCard } from '../src/index';

const job: Career = {
  id: 1,
  title: 'Network technician',
  organization: 'Savanna Labs',
  description: 'Install and support campus networks.',
  location: 'Addis Ababa',
  applicationUrl: 'https://jobs.example/network-technician',
  audioSummaryUrl: 'https://media.example/network-technician.mp3',
  accommodations: 'Sign language interpretation is available on request.',
  certificateVerificationUrl: 'https://api.example/api/v1/certificates/cert-valid/verify',
};

async function mount(props: { job?: Career; headingLevel?: number } = {}): Promise<JobCard> {
  const card = document.createElement('savanna-job-card') as JobCard;
  if (props.job !== undefined) card.job = props.job;
  if (props.headingLevel !== undefined) card.headingLevel = props.headingLevel;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response('{}', { status: 404 }))),
  );
});

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('career gateway elements', () => {
  it('registers <savanna-job-card>', () => {
    expect(customElements.get('savanna-job-card')).toBe(JobCard);
  });

  it('registers <savanna-certificate-link>', () => {
    expect(customElements.get('savanna-certificate-link')).toBe(CertificateLink);
  });
});

describe('job card (spec 4.8)', () => {
  it('renders title as a heading at the configured level', async () => {
    const card = await mount({ job });
    expect(card.shadowRoot?.querySelector('h3')?.textContent).toBe(job.title);

    card.headingLevel = 2;
    await card.updateComplete;
    expect(card.shadowRoot?.querySelector('h2')?.textContent).toBe(job.title);
    expect(card.shadowRoot?.querySelector('h3')).toBeNull();
  });

  it('shows organization, description and accommodation information', async () => {
    const card = await mount({ job });
    const text = card.shadowRoot?.textContent ?? '';
    expect(text).toContain(job.organization);
    expect(text).toContain(job.description);
    expect(text).toContain(job.accommodations);

    card.job = { ...job, accommodations: null };
    await card.updateComplete;
    expect(card.shadowRoot?.textContent).not.toContain('Sign language interpretation');
  });

  it('application link has a descriptive accessible name', async () => {
    const card = await mount({ job });
    const link = card.shadowRoot?.querySelector('a');
    expect(link?.getAttribute('href')).toBe(job.applicationUrl);
    expect(link?.textContent).toBe('Apply for Network technician at Savanna Labs');
    expect(link?.textContent).not.toBe(job.applicationUrl);
  });

  it('audio summary has accessible play controls and a text alternative', async () => {
    const card = await mount({ job });
    const audio = card.shadowRoot?.querySelector('audio');
    expect(audio?.hasAttribute('controls')).toBe(true);
    expect(audio?.getAttribute('src')).toBe(job.audioSummaryUrl);
    expect(card.shadowRoot?.querySelector('#job-description')?.textContent).toBe(job.description);
    expect(audio?.getAttribute('aria-labelledby')).toBe('job-description');

    card.job = { ...job, audioSummaryUrl: null };
    await card.updateComplete;
    expect(card.shadowRoot?.querySelector('audio')).toBeNull();
  });

  it('renders a certificate link from a valid verification URL', async () => {
    const card = await mount({ job });
    const link = card.shadowRoot?.querySelector('savanna-certificate-link');
    expect(link?.getAttribute('certificate-id')).toBe('cert-valid');
    expect(link?.getAttribute('api-base')).toBe('https://api.example');
    expect(link?.textContent?.toLowerCase()).not.toContain('verified');

    card.job = {
      ...job,
      certificateVerificationUrl:
        'https://api.example/bridge/api/v1/certificates/cert-valid/verify/',
    };
    await card.updateComplete;
    const prefixed = card.shadowRoot?.querySelector('savanna-certificate-link');
    expect(prefixed?.getAttribute('certificate-id')).toBe('cert-valid');
    expect(prefixed?.getAttribute('api-base')).toBe('https://api.example/bridge');
  });

  it('omits the certificate link when the verification URL is null', async () => {
    const card = await mount({ job: { ...job, certificateVerificationUrl: null } });
    expect(card.shadowRoot?.querySelector('savanna-certificate-link')).toBeNull();
  });

  it('omits the certificate link when the verification URL is malformed', async () => {
    const card = await mount({
      job: { ...job, certificateVerificationUrl: 'not a url' },
    });
    expect(card.shadowRoot?.querySelector('savanna-certificate-link')).toBeNull();

    card.job = { ...job, certificateVerificationUrl: 'https://jobs.example/apply' };
    await card.updateComplete;
    expect(card.shadowRoot?.querySelector('savanna-certificate-link')).toBeNull();

    card.job = {
      ...job,
      certificateVerificationUrl: 'https://api.example/api/v1/certificates/cert-valid',
    };
    await card.updateComplete;
    expect(card.shadowRoot?.querySelector('savanna-certificate-link')).toBeNull();

    for (const certificateVerificationUrl of [
      'https://api.example/api/v1/certificates/cert-valid/verify?lang=en',
      'https://api.example/api/v1/certificates/cert-valid/verify#result',
      'https://api.example/api/v1/certificates/%20/verify',
      'https://api.example/api/v1/certificates/cert%2F1/verify',
    ]) {
      card.job = { ...job, certificateVerificationUrl };
      await card.updateComplete;
      expect(card.shadowRoot?.querySelector('savanna-certificate-link')).toBeNull();
    }
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function mountCertificate(certificateId = '', apiBase = ''): Promise<CertificateLink> {
  const link = document.createElement('savanna-certificate-link') as CertificateLink;
  link.certificateId = certificateId;
  link.apiBase = apiBase;
  document.body.append(link);
  await link.updateComplete;
  return link;
}

function statusRegion(link: CertificateLink): HTMLElement {
  const region = link.shadowRoot?.querySelector<HTMLElement>('[role="status"]');
  if (region === null || region === undefined) throw new Error('status region is missing');
  return region;
}

describe('certificate verification (spec 4.8)', () => {
  it('shows "verified" only after the verify endpoint reports valid', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/cert%2F1/verify')) {
        return Promise.resolve(jsonResponse({ valid: true, status: 'valid' }));
      }
      return Promise.resolve(jsonResponse({ valid: true, status: 'revoked' }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const link = await mountCertificate('cert/1', 'https://api.example/bridge');
    await vi.waitFor(() => expect(statusRegion(link).textContent).toBe('Verified'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://api.example/bridge/api/v1/certificates/cert%2F1/verify',
    );

    link.certificateId = 'cert-mismatch';
    await vi.waitFor(() => expect(statusRegion(link).textContent).toBe('Verification unavailable'));
    expect(statusRegion(link).textContent).not.toBe('Verified');
  });

  it('shows revoked certificates as not valid', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(jsonResponse({ valid: false, status: 'revoked' })),
    );
    const link = await mountCertificate('cert-revoked', 'https://api.example');
    await vi.waitFor(() => expect(statusRegion(link).textContent).toBe('Not valid'));
  });

  it('announces the verification result to screen readers', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(jsonResponse({ valid: true, status: 'valid' })));
    const link = await mountCertificate('cert-valid', 'https://api.example');
    const region = statusRegion(link);

    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    await vi.waitFor(() => expect(region.textContent).toBe('Verified'));
  });

  it('shows verification unavailable when the response is not proof or the request fails', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(jsonResponse({ detail: 'missing' }, 404)));
    const missing = await mountCertificate('missing-certificate', 'https://api.example');
    await vi.waitFor(() =>
      expect(statusRegion(missing).textContent).toBe('Verification unavailable'),
    );

    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
    const offline = await mountCertificate('offline-certificate', 'https://api.example');
    await vi.waitFor(() =>
      expect(statusRegion(offline).textContent).toBe('Verification unavailable'),
    );

    vi.stubGlobal('fetch', () => Promise.resolve(jsonResponse({ valid: true })));
    const partial = await mountCertificate('partial-certificate', 'https://api.example');
    await vi.waitFor(() =>
      expect(statusRegion(partial).textContent).toBe('Verification unavailable'),
    );
  });

  it('does not request verification when the id or API base is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const link = await mountCertificate();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(statusRegion(link).textContent).toBe('Verification unavailable');

    link.certificateId = 'cert-valid';
    await link.updateComplete;
    expect(fetchMock).not.toHaveBeenCalled();

    link.certificateId = '';
    link.apiBase = 'https://api.example';
    await link.updateComplete;
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requests the new certificate and ignores a stale response', async () => {
    const pending = new Map<string, (response: Response) => void>();
    vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
      const url = String(input);
      return new Promise<Response>((resolve) => {
        pending.set(url, resolve);
      });
    });

    const link = await mountCertificate('cert-a', 'https://api.example');
    await vi.waitFor(() => expect(pending.size).toBe(1));
    link.certificateId = 'cert-b';
    await vi.waitFor(() => expect(pending.size).toBe(2));

    const first = [...pending.keys()].find((url) => url.includes('/cert-a/'));
    const second = [...pending.keys()].find((url) => url.includes('/cert-b/'));
    if (first === undefined || second === undefined)
      throw new Error('verification requests were not started');

    pending.get(first)?.(jsonResponse({ valid: true, status: 'valid' }));
    await link.updateComplete;
    await Promise.resolve();
    expect(statusRegion(link).textContent).not.toBe('Verified');

    pending.get(second)?.(jsonResponse({ valid: false, status: 'revoked' }));
    await vi.waitFor(() => expect(statusRegion(link).textContent).toBe('Not valid'));

    link.requestUpdate();
    await link.updateComplete;
    expect(pending.size).toBe(2);
  });

  it('requests verification again when the API base changes', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Promise<Response>(() => undefined);
    });

    const link = await mountCertificate('cert-valid', 'https://api.example');
    await vi.waitFor(() => expect(urls).toHaveLength(1));
    link.apiBase = 'https://api.example/bridge';
    await vi.waitFor(() => expect(urls).toHaveLength(2));
    expect(urls[0]).toBe('https://api.example/api/v1/certificates/cert-valid/verify');
    expect(urls[1]).toBe('https://api.example/bridge/api/v1/certificates/cert-valid/verify');
  });

  it('does not apply a response that arrives after disconnection', async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const link = await mountCertificate('cert-valid', 'https://api.example');
    await vi.waitFor(() => expect(resolveRequest).toBeTypeOf('function'));
    link.remove();
    resolveRequest?.(jsonResponse({ valid: true, status: 'valid' }));
    await link.updateComplete;
    await Promise.resolve();
    expect(statusRegion(link).textContent).not.toBe('Verified');
  });

  it('requests verification again after reconnecting', async () => {
    const pending: Array<(response: Response) => void> = [];
    vi.stubGlobal(
      'fetch',
      () =>
        new Promise<Response>((resolve) => {
          pending.push(resolve);
        }),
    );

    const link = await mountCertificate('cert-valid', 'https://api.example');
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    link.remove();
    document.body.append(link);
    await vi.waitFor(() => expect(pending).toHaveLength(2));

    pending[1]?.(jsonResponse({ valid: true, status: 'valid' }));
    await vi.waitFor(() => expect(statusRegion(link).textContent).toBe('Verified'));

    pending[0]?.(jsonResponse({ valid: false, status: 'revoked' }));
    await link.updateComplete;
    await Promise.resolve();
    expect(statusRegion(link).textContent).toBe('Verified');
  });
});
