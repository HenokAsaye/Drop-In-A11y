import { describe, expect, it } from 'vitest';

import { CertificateLink, JobCard } from '../src/index';

describe('career gateway elements', () => {
  it('registers <savanna-job-card>', () => {
    expect(customElements.get('savanna-job-card')).toBe(JobCard);
  });

  it('registers <savanna-certificate-link>', () => {
    expect(customElements.get('savanna-certificate-link')).toBe(CertificateLink);
  });
});

describe('job card (spec 4.8)', () => {
  it.todo('renders title as a heading at the configured level');
  it.todo('shows organization, description and accommodation information');
  it.todo('application link has a descriptive accessible name');
  it.todo('audio summary has accessible play controls and a text alternative');
  it.todo('remains usable at 200% zoom and 320px width (Playwright e2e)');
});

describe('certificate verification (spec 4.8)', () => {
  it.todo('shows "verified" only after the verify endpoint reports valid');
  it.todo('shows revoked certificates as not valid');
  it.todo('announces the verification result to screen readers');
});
