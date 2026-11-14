import { describe, expect, it } from 'vitest';

import { DEFAULT_CAPTION_SETTINGS } from '../src/captions/caption-settings';

describe('caption settings (spec 4.2)', () => {
  it('enables English captions by default', () => {
    expect(DEFAULT_CAPTION_SETTINGS).toMatchObject({ enabled: true, language: 'en', fontScale: 1 });
  });

  it('defaults cannot be mutated by a consumer', () => {
    expect(Object.isFrozen(DEFAULT_CAPTION_SETTINGS)).toBe(true);
  });

  it.todo('loads English and Amharic WebVTT tracks from lesson metadata');
  it.todo('switches caption language');
  it.todo('applies font size, text color, background color and high-contrast settings');
  it.todo('persists caption settings across lessons');
  it.todo('renders Amharic (Ethiopic) text without fallback glyphs');
});
