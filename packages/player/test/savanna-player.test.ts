import { afterEach, describe, expect, it, vi } from 'vitest';

import '../src/index';
import { SavannaPlayer } from '../src/components/savanna-player';

async function mount(attributes: Record<string, string>): Promise<SavannaPlayer> {
  const element = document.createElement('savanna-player');
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  document.body.append(element);
  await element.updateComplete;
  return element;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('<savanna-player> integration contract', () => {
  it('registers the custom element', () => {
    expect(customElements.get('savanna-player')).toBe(SavannaPlayer);
  });

  it('reads lesson-id and api-base attributes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => new Promise(() => {})),
    );
    const player = await mount({
      'lesson-id': 'networking-101',
      'api-base': 'https://api.example',
    });

    expect(player.lessonId).toBe('networking-101');
    expect(player.apiBase).toBe('https://api.example');
  });

  it('renders inside a shadow root with a labelled region', async () => {
    const player = await mount({ 'lesson-id': 'networking-101' });

    const region = player.shadowRoot?.querySelector('section');
    expect(region?.getAttribute('aria-label')).toBe('Lesson player');
  });

  it('survives the bundle being loaded twice on the same page', async () => {
    await expect(import('../src/components/savanna-player')).resolves.toBeDefined();
  });
});

describe('<savanna-player> lesson loading (spec 2.3, 4.1)', () => {
  it('requests lesson metadata from api-base when lesson-id is set', async () => {
    const lessonData = {
      id: 'networking-101',
      title: 'Introduction to Networking',
      description: 'Basics of networking',
      language: 'en',
      media: { video: 'https://media.example.com/networking-101.mp4' },
      captions: [],
      transcripts: [],
      documents: [],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => lessonData,
    });
    vi.stubGlobal('fetch', fetchMock);

    const player = await mount({
      'lesson-id': 'networking-101',
      'api-base': 'https://api.example.com',
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await player.updateComplete;

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/lessons/networking-101',
      expect.anything(),
    );
    expect(player.status).toBe('ready');
    const video = player.shadowRoot?.querySelector('video');
    expect(video?.getAttribute('src')).toBe('https://media.example.com/networking-101.mp4');
  });

  it('exposes a loading state announced to screen readers', async () => {
    let resolveFetch: (val: unknown) => void;
    const pending = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal('fetch', () => pending);

    const player = await mount({
      'lesson-id': 'networking-101',
      'api-base': 'https://api.example.com',
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await player.updateComplete;

    expect(player.status).toBe('loading');
    const statusEl = player.shadowRoot?.querySelector('[role="status"]');
    expect(statusEl?.textContent).toMatch(/loading/i);

    resolveFetch!({
      ok: true,
      json: async () => ({ id: 'networking-101', media: { video: 'test.mp4' } }),
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await player.updateComplete;
  });

  it('exposes an empty state when the lesson has no media', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'networking-101', media: { video: '' } }),
      }),
    );

    const player = await mount({
      'lesson-id': 'networking-101',
      'api-base': 'https://api.example.com',
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await player.updateComplete;

    expect(player.status).toBe('empty');
    const statusEl = player.shadowRoot?.querySelector('[role="status"]');
    expect(statusEl?.textContent).toMatch(/no media/i);
  });

  it('exposes an error state and emits savanna-error when the API fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }),
    );

    let errorEvent: CustomEvent<{ message: string }> | null = null;
    const player = document.createElement('savanna-player');
    player.addEventListener('savanna-error', (e) => {
      errorEvent = e as CustomEvent<{ message: string }>;
    });
    player.setAttribute('lesson-id', 'missing-lesson');
    player.setAttribute('api-base', 'https://api.example.com');
    document.body.append(player);
    await player.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 20));
    await player.updateComplete;

    expect(player.status).toBe('error');
    expect(errorEvent).not.toBeNull();
    const alertEl = player.shadowRoot?.querySelector('[role="alert"]');
    expect(alertEl).not.toBeNull();
  });

  it('reloads when lesson-id changes and aborts the previous request', async () => {
    let signal1: AbortSignal | undefined;
    let signal2: AbortSignal | undefined;
    let callCount = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url, init) => {
        callCount++;
        if (callCount === 1) {
          signal1 = init?.signal;
          return new Promise(() => {}); // never resolves
        }
        signal2 = init?.signal;
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 'lesson-2', media: { video: 'lesson-2.mp4' } }),
        });
      }),
    );

    const player = await mount({
      'lesson-id': 'lesson-1',
      'api-base': 'https://api.example.com',
    });
    await player.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(signal1?.aborted).toBe(false);

    player.setAttribute('lesson-id', 'lesson-2');
    await player.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 20));
    await player.updateComplete;

    expect(signal1?.aborted).toBe(true);
    expect(signal2).toBeDefined();
    expect(player.status).toBe('ready');
  });
});

describe('<savanna-player> video controls (spec 4.1)', () => {
  it('play/pause, seek, volume, mute, speed and fullscreen use native buttons and inputs', async () => {
    const player = await mount({ 'lesson-id': 'networking-101' });

    const playBtn = player.shadowRoot?.querySelector('button.play-btn');
    const seekInput = player.shadowRoot?.querySelector('input[type="range"].seek-range');
    const muteBtn = player.shadowRoot?.querySelector('button.mute-btn');
    const volumeInput = player.shadowRoot?.querySelector('input[type="range"].volume-range');
    const speedBtn = player.shadowRoot?.querySelector('button.speed-btn');
    const fullscreenBtn = player.shadowRoot?.querySelector('button.fullscreen-btn');

    expect(playBtn).toBeInstanceOf(HTMLButtonElement);
    expect(seekInput).toBeInstanceOf(HTMLInputElement);
    expect(muteBtn).toBeInstanceOf(HTMLButtonElement);
    expect(volumeInput).toBeInstanceOf(HTMLInputElement);
    expect(speedBtn).toBeInstanceOf(HTMLButtonElement);
    expect(fullscreenBtn).toBeInstanceOf(HTMLButtonElement);
  });

  it('every control has an accessible name', async () => {
    const player = await mount({ 'lesson-id': 'networking-101' });

    const controls = player.shadowRoot?.querySelectorAll('button, input');
    expect(controls && controls.length).toBeGreaterThanOrEqual(6);

    controls?.forEach((ctrl) => {
      const ariaLabel = ctrl.getAttribute('aria-label');
      const text = ctrl.textContent?.trim();
      expect(ariaLabel || text).toBeTruthy();
    });

    const playBtn = player.shadowRoot?.querySelector('button.play-btn');
    expect(playBtn?.getAttribute('aria-label')).toBe('Play');
    expect(playBtn?.querySelector('.visually-hidden')?.textContent).toBe('Play');

    const seekInput = player.shadowRoot?.querySelector('input.seek-range');
    expect(seekInput?.getAttribute('aria-label')).toBe('Seek');

    const muteBtn = player.shadowRoot?.querySelector('button.mute-btn');
    expect(muteBtn?.getAttribute('aria-label')).toBe('Mute');
    expect(muteBtn?.querySelector('.visually-hidden')?.textContent).toBe('Mute');

    const volumeInput = player.shadowRoot?.querySelector('input.volume-range');
    expect(volumeInput?.getAttribute('aria-label')).toBe('Volume');

    const speedBtn = player.shadowRoot?.querySelector('button.speed-btn');
    expect(speedBtn?.getAttribute('aria-label')).toBe('Playback speed');
    expect(speedBtn?.querySelector('.visually-hidden')?.textContent).toContain('Playback speed');

    const fullscreenBtn = player.shadowRoot?.querySelector('button.fullscreen-btn');
    expect(fullscreenBtn?.getAttribute('aria-label')).toBe('Fullscreen');
    expect(fullscreenBtn?.querySelector('.visually-hidden')?.textContent).toBe('Fullscreen');
  });

  it('focus is always visible', async () => {
    const styles = SavannaPlayer.styles.toString();
    expect(styles).toContain(':focus-visible');
    expect(styles).toContain('outline');
    expect(styles).toContain('outline-offset');
  });

  it('state is not conveyed by color alone', async () => {
    const player = await mount({ 'lesson-id': 'networking-101' });

    const playBtn = player.shadowRoot?.querySelector('button.play-btn') as HTMLButtonElement;
    expect(playBtn.getAttribute('aria-label')).toBe('Play');
    expect(playBtn.querySelector('span[aria-hidden="true"]')?.textContent).toBe('▶');
    expect(playBtn.querySelector('.visually-hidden')?.textContent).toBe('Play');

    // Simulate play
    await player.togglePlay();
    await player.updateComplete;

    expect(playBtn.getAttribute('aria-label')).toBe('Pause');
    expect(playBtn.querySelector('span[aria-hidden="true"]')?.textContent).toBe('⏸');
    expect(playBtn.querySelector('.visually-hidden')?.textContent).toBe('Pause');

    // Mute toggle
    const muteBtn = player.shadowRoot?.querySelector('button.mute-btn') as HTMLButtonElement;
    expect(muteBtn.getAttribute('aria-label')).toBe('Mute');
    expect(muteBtn.querySelector('span[aria-hidden="true"]')?.textContent).toBe('🔊');

    player.toggleMute();
    await player.updateComplete;

    expect(muteBtn.getAttribute('aria-label')).toBe('Unmute');
    expect(muteBtn.querySelector('span[aria-hidden="true"]')?.textContent).toBe('🔇');
    expect(muteBtn.querySelector('.visually-hidden')?.textContent).toBe('Unmute');

    // Speed cycle
    const speedBtn = player.shadowRoot?.querySelector('button.speed-btn') as HTMLButtonElement;
    expect(speedBtn.querySelector('span[aria-hidden="true"]')?.textContent).toBe('1x');
    player.cyclePlaybackSpeed();
    await player.updateComplete;
    expect(speedBtn.querySelector('span[aria-hidden="true"]')?.textContent).toBe('1.25x');
  });
});
