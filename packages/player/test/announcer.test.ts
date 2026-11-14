import { describe, expect, it } from 'vitest';

import { Announcer } from '../src/accessibility/announcer';

describe('Announcer', () => {
  it('writes a status message into a polite live region', () => {
    const region = document.createElement('div');
    const announcer = new Announcer(region);

    announcer.announce('Loading lesson networking-101.');

    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('aria-atomic')).toBe('true');
    expect(region.textContent).toBe('Loading lesson networking-101.');
  });

  it('replaces the previous message', () => {
    const region = document.createElement('p');
    const announcer = new Announcer(region);

    announcer.announce('Loading lesson networking-101.');
    announcer.announce('This lesson has no video.');

    expect(region.textContent).toBe('This lesson has no video.');
  });

  it('leaves an alert role in place', () => {
    const region = document.createElement('p');
    region.setAttribute('role', 'alert');
    region.setAttribute('aria-live', 'assertive');

    new Announcer(region).announce("Lesson 'missing' was not found");

    expect(region.getAttribute('role')).toBe('alert');
    expect(region.getAttribute('aria-live')).toBe('assertive');
    expect(region.textContent).toBe("Lesson 'missing' was not found");
  });
});
