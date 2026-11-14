import type { PlayerStatus } from '@savanna/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../src/index';
import { SavannaPlayer } from '../src/components/savanna-player';

function lessonBody(
  id: string,
  title: string,
  video: string | null = 'https://media.example/video.mp4',
) {
  return {
    id,
    title,
    description: 'Learn the fundamentals of computer networking.',
    language: 'en',
    media: {
      video,
      audio: null,
      signLanguage: null,
      audioDescription: null,
      poster: null,
    },
    captions: [],
    transcripts: [],
    documents: [],
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function deferredResponse(): {
  promise: Promise<Response>;
  resolve: (value: Response) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve: (value: Response) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<Response>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function hangUntilAbort(_input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    const abort = () => reject(new DOMException('The operation was aborted.', 'AbortError'));
    if (init?.signal?.aborted) {
      abort();
      return;
    }
    init?.signal?.addEventListener('abort', abort, { once: true });
  });
}

async function mount(
  attributes: Record<string, string>,
  element: SavannaPlayer = document.createElement('savanna-player'),
): Promise<SavannaPlayer> {
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  document.body.append(element);
  await element.updateComplete;
  return element;
}

function statusRegion(player: SavannaPlayer): HTMLElement {
  const region = player.shadowRoot?.querySelector<HTMLElement>('#player-status');
  if (region === null || region === undefined) throw new Error('player status region is missing');
  return region;
}

function listen(player: SavannaPlayer): { statuses: PlayerStatus[]; errors: string[] } {
  const statuses: PlayerStatus[] = [];
  const errors: string[] = [];
  player.addEventListener('savanna-status-change', ((
    event: CustomEvent<{ status: PlayerStatus }>,
  ) => {
    statuses.push(event.detail.status);
  }) as EventListener);
  player.addEventListener('savanna-error', ((event: CustomEvent<{ message: string }>) => {
    errors.push(event.detail.message);
  }) as EventListener);
  return { statuses, errors };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(hangUntilAbort));
});

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
    const fetchMock = vi.mocked(fetch);
    const player = await mount({ 'lesson-id': 'networking-101' });

    const region = player.shadowRoot?.querySelector('section');
    expect(region?.getAttribute('aria-label')).toBe('Lesson player');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('survives the bundle being loaded twice on the same page', async () => {
    await expect(import('../src/components/savanna-player')).resolves.toBeDefined();
  });
});

describe('<savanna-player> lesson loading (spec 2.3, 4.1)', () => {
  it('requests lesson metadata from api-base when lesson-id is set', async () => {
    const pending = deferredResponse();
    const fetchMock = vi.fn(() => pending.promise);
    vi.stubGlobal('fetch', fetchMock);
    const element = document.createElement('savanna-player');
    const events = listen(element);

    const player = await mount(
      { 'lesson-id': 'networking-101', 'api-base': 'https://api.example' },
      element,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example/api/v1/lessons/networking-101',
      expect.objectContaining({
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: expect.any(AbortSignal) as AbortSignal,
      }),
    );

    pending.resolve(jsonResponse(lessonBody('networking-101', 'Introduction to Networking')));
    await vi.waitFor(() => {
      expect(player.status).toBe('ready');
      expect(statusRegion(player).textContent).toBe('Lesson ready: Introduction to Networking.');
    });
    expect(player.lesson?.id).toBe('networking-101');
    expect(events.statuses).toEqual(['loading', 'ready']);
    expect(events.errors).toEqual([]);

    const video = player.shadowRoot?.querySelector('video');
    expect(video?.getAttribute('src')).toBe('https://media.example/video.mp4');
  });

  it('exposes a loading state announced to screen readers', async () => {
    const element = document.createElement('savanna-player');
    const events = listen(element);

    const player = await mount(
      { 'lesson-id': 'networking-101', 'api-base': 'https://api.example' },
      element,
    );

    const region = statusRegion(player);
    const alert = player.shadowRoot?.querySelector<HTMLElement>('#player-error');
    expect(player.status).toBe('loading');
    expect(region.hidden).toBe(false);
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('aria-atomic')).toBe('true');
    expect(region.textContent).toBe('Loading lesson networking-101.');
    expect(alert?.hidden).toBe(true);
    expect(events.statuses).toEqual(['loading']);
  });

  it('exposes an empty state when the lesson has no media', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(lessonBody('networking-101', 'Introduction to Networking', '')),
    );
    vi.stubGlobal('fetch', fetchMock);
    const element = document.createElement('savanna-player');
    const events = listen(element);

    const player = await mount(
      { 'lesson-id': 'networking-101', 'api-base': 'https://api.example' },
      element,
    );

    await vi.waitFor(() => {
      expect(player.status).toBe('empty');
    });
    const region = statusRegion(player);
    expect(region.textContent).toBe('This lesson has no video.');
    expect(region.getAttribute('role')).toBe('status');
    expect(events.statuses).toEqual(['loading', 'empty']);
    expect(events.errors).toEqual([]);
  });

  it('exposes an error state and emits savanna-error when the API fails', async () => {
    const message = "Lesson 'networking-101' was not found";
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ detail: message, code: 'not_found', resource: 'Lesson' }, 404),
      ),
    );
    const element = document.createElement('savanna-player');
    const events = listen(element);

    const player = await mount(
      { 'lesson-id': 'networking-101', 'api-base': 'https://api.example' },
      element,
    );

    await vi.waitFor(() => {
      expect(player.status).toBe('error');
      expect(player.shadowRoot?.querySelector('#player-error')?.textContent).toBe(message);
    });
    const alert = player.shadowRoot?.querySelector<HTMLElement>('#player-error');
    expect(alert?.hidden).toBe(false);
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.textContent).toBe(message);
    expect(alert?.textContent?.trim().length).toBeGreaterThan(0);
    expect(statusRegion(player).hidden).toBe(true);
    expect(player.lesson).toBeNull();
    expect(events.statuses).toEqual(['loading', 'error']);
    expect(events.errors).toEqual([message]);
  });

  it('reloads when lesson-id changes and aborts the previous request', async () => {
    const signals: AbortSignal[] = [];
    const pending: Array<ReturnType<typeof deferredResponse>> = [];
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal) signals.push(init.signal);
      const next = deferredResponse();
      pending.push(next);
      return next.promise;
    });
    vi.stubGlobal('fetch', fetchMock);

    const player = await mount({
      'lesson-id': 'networking-101',
      'api-base': 'https://api.example',
    });
    expect(player.status).toBe('loading');

    player.setAttribute('lesson-id', 'networking-102');
    await player.updateComplete;

    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      'https://api.example/api/v1/lessons/networking-102',
    );
    expect(statusRegion(player).textContent).toBe('Loading lesson networking-102.');

    pending[0]?.resolve(jsonResponse(lessonBody('networking-101', 'Introduction to Networking')));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(player.status).toBe('loading');
    expect(player.lesson).toBeNull();

    pending[1]?.resolve(jsonResponse(lessonBody('networking-102', 'Network Services')));
    await vi.waitFor(() => {
      expect(player.status).toBe('ready');
      expect(statusRegion(player).textContent).toBe('Lesson ready: Network Services.');
    });
    expect(player.lesson?.id).toBe('networking-102');
  });
});

describe('<savanna-player> keyboard shortcuts (spec 5.1)', () => {
  it('claims shortcuts while focus is inside the player and leaves typing controls alone', async () => {
    const player = await mount({});
    const hostEvent = new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    player.dispatchEvent(hostEvent);
    expect(hostEvent.defaultPrevented).toBe(true);

    const search = document.createElement('input');
    player.shadowRoot?.append(search);
    const typing = new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    search.dispatchEvent(typing);
    expect(typing.defaultPrevented).toBe(false);
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
      const id = ctrl.getAttribute('id');
      const labelled = id
        ? player.shadowRoot?.querySelector(`label[for="${id}"]`)?.textContent?.trim()
        : '';
      expect(ariaLabel || text || labelled).toBeTruthy();
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
    expect(speedBtn?.getAttribute('aria-label')).toBe('Playback speed: 1x');
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

    await player.togglePlay();
    await player.updateComplete;

    expect(playBtn.getAttribute('aria-label')).toBe('Pause');
    expect(playBtn.querySelector('span[aria-hidden="true"]')?.textContent).toBe('⏸');
    expect(playBtn.querySelector('.visually-hidden')?.textContent).toBe('Pause');

    const muteBtn = player.shadowRoot?.querySelector('button.mute-btn') as HTMLButtonElement;
    expect(muteBtn.getAttribute('aria-label')).toBe('Mute');
    expect(muteBtn.querySelector('span[aria-hidden="true"]')?.textContent).toBe('🔊');

    player.toggleMute();
    await player.updateComplete;

    expect(muteBtn.getAttribute('aria-label')).toBe('Unmute');
    expect(muteBtn.querySelector('span[aria-hidden="true"]')?.textContent).toBe('🔇');
    expect(muteBtn.querySelector('.visually-hidden')?.textContent).toBe('Unmute');

    const speedBtn = player.shadowRoot?.querySelector('button.speed-btn') as HTMLButtonElement;
    expect(speedBtn.querySelector('span[aria-hidden="true"]')?.textContent).toBe('1x');
    expect(speedBtn.getAttribute('aria-label')).toBe('Playback speed: 1x');
    player.cyclePlaybackSpeed();
    await player.updateComplete;
    expect(speedBtn.querySelector('span[aria-hidden="true"]')?.textContent).toBe('1.25x');
    expect(speedBtn.getAttribute('aria-label')).toBe('Playback speed: 1.25x');
  });
});
