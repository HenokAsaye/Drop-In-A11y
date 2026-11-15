import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../src/index';
import type { SavannaPlayer } from '../src/components/savanna-player';
import { CAPTION_SETTINGS_KEY, LESSON_POSITIONS_KEY, PLAYBACK_SETTINGS_KEY } from '../src/config';
import { FORCED_COLORS_QUERY, REDUCED_MOTION_QUERY } from '../src/media-preferences';

function installMedia(initial: Record<string, boolean>) {
  const state = new Map(Object.entries(initial));
  const listeners = new Map<string, Set<() => void>>();
  vi.stubGlobal('matchMedia', (query: string) => {
    if (!listeners.has(query)) listeners.set(query, new Set());
    return {
      media: query,
      get matches() {
        return state.get(query) === true;
      },
      addEventListener(type: string, listener: () => void) {
        if (type === 'change') listeners.get(query)?.add(listener);
      },
      removeEventListener(type: string, listener: () => void) {
        if (type === 'change') listeners.get(query)?.delete(listener);
      },
    };
  });
  return {
    set(query: string, matches: boolean) {
      state.set(query, matches);
      listeners.get(query)?.forEach((listener) => listener());
    },
  };
}

async function mount(): Promise<SavannaPlayer> {
  const player = document.createElement('savanna-player');
  player.setAttribute('lesson-id', 'networking-101');
  player.setAttribute('api-base', 'https://api.example');
  document.body.append(player);
  await player.updateComplete;
  return player;
}

function contrastBox(player: SavannaPlayer): HTMLInputElement {
  const box = player.shadowRoot?.querySelector<HTMLInputElement>('#caption-contrast');
  if (box === null || box === undefined) throw new Error('caption contrast checkbox is missing');
  return box;
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  );
});

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('device caption and motion preferences', () => {
  it('uses forced colors only until the learner chooses caption settings', async () => {
    const media = installMedia({ [FORCED_COLORS_QUERY]: true });
    const player = await mount();

    expect(contrastBox(player).checked).toBe(true);
    expect(localStorage.getItem(CAPTION_SETTINGS_KEY)).toBeNull();

    media.set(FORCED_COLORS_QUERY, false);
    await player.updateComplete;
    expect(contrastBox(player).checked).toBe(false);
    expect(localStorage.getItem(CAPTION_SETTINGS_KEY)).toBeNull();

    media.set(FORCED_COLORS_QUERY, true);
    await player.updateComplete;
    const box = contrastBox(player);
    box.checked = false;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    await player.updateComplete;

    const saved = JSON.parse(localStorage.getItem(CAPTION_SETTINGS_KEY) ?? '{}') as {
      highContrast?: boolean;
    };
    expect(saved.highContrast).toBe(false);

    media.set(FORCED_COLORS_QUERY, true);
    await player.updateComplete;
    expect(contrastBox(player).checked).toBe(false);

    player.remove();
    const reloaded = await mount();
    expect(contrastBox(reloaded).checked).toBe(false);
    expect(JSON.parse(localStorage.getItem(CAPTION_SETTINGS_KEY) ?? '{}')).toMatchObject({
      highContrast: false,
    });
  });

  it('follows reduced motion without changing playback storage', async () => {
    localStorage.setItem(
      PLAYBACK_SETTINGS_KEY,
      JSON.stringify({ volume: 0.4, playbackRate: 1.25, muted: true }),
    );
    localStorage.setItem(LESSON_POSITIONS_KEY, JSON.stringify({ 'networking-101': 12 }));
    const playback = localStorage.getItem(PLAYBACK_SETTINGS_KEY);
    const positions = localStorage.getItem(LESSON_POSITIONS_KEY);

    const media = installMedia({ [REDUCED_MOTION_QUERY]: true, [FORCED_COLORS_QUERY]: false });
    const player = await mount();
    const sign = player.shadowRoot?.querySelector('savanna-sign-language');
    const transcript = player.shadowRoot?.querySelector('savanna-transcript');

    expect(player.hasAttribute('reduced-motion')).toBe(true);
    expect(sign?.hasAttribute('reduced-motion')).toBe(true);
    expect(contrastBox(player).checked).toBe(false);
    expect(transcript).toBeNull();

    media.set(REDUCED_MOTION_QUERY, false);
    await player.updateComplete;
    await sign?.updateComplete;
    expect(player.hasAttribute('reduced-motion')).toBe(false);
    expect(sign?.hasAttribute('reduced-motion')).toBe(false);

    expect(localStorage.getItem(PLAYBACK_SETTINGS_KEY)).toBe(playback);
    expect(localStorage.getItem(LESSON_POSITIONS_KEY)).toBe(positions);
    expect(localStorage.getItem(CAPTION_SETTINGS_KEY)).toBeNull();
  });
});
