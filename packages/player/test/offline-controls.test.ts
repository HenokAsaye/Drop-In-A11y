import type { DownloadManager, DownloadProgress, OfflineMode } from '@savanna/offline';
import { afterEach, describe, expect, it, vi } from 'vitest';

import '../src/index';
import type { SavannaPlayer } from '../src/components/savanna-player';

const lesson = {
  id: 'networking-101',
  title: 'Networking 101',
  description: 'Learn networking.',
  language: 'en',
  media: {
    video: 'https://media.example/v.mp4',
    audio: null,
    signLanguage: null,
    audioDescription: null,
    poster: null,
  },
  captions: [],
  transcripts: [],
  documents: [],
};
const offlinePackage = { lessonId: 'networking-101', version: 'v1', resources: [] };

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
}

function stubApi(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith('/offline') ? json(offlinePackage) : json(lesson),
    ),
  );
}

function fakeManager(
  initial: 'downloaded' | 'not-downloaded' = 'not-downloaded',
  mode: OfflineMode = 'audio',
) {
  return {
    download: vi.fn(
      async (pkg?: unknown, mode?: unknown, onProgress?: (progress: DownloadProgress) => void) => {
        void pkg;
        void mode;
        void onProgress;
      },
    ),
    remove: vi.fn(async () => {}),
    status: vi.fn(async () => initial),
    record: vi.fn(async () =>
      initial === 'downloaded'
        ? {
            lessonId: 'networking-101',
            version: 'v1',
            mode,
            sizeBytes: 1,
            downloadedAt: '2026-11-15T00:00:00.000Z',
            package: offlinePackage,
          }
        : undefined,
    ),
  };
}

async function mount(manager?: ReturnType<typeof fakeManager>): Promise<SavannaPlayer> {
  const player = document.createElement('savanna-player');
  if (manager) player.offlineManager = manager as unknown as DownloadManager;
  player.setAttribute('lesson-id', 'networking-101');
  player.setAttribute('api-base', 'https://api.example');
  document.body.append(player);
  await vi.waitFor(() => expect(player.status).toBe('ready'));
  await player.updateComplete;
  return player;
}

function button(player: SavannaPlayer, text: string): HTMLButtonElement {
  const found = [...(player.shadowRoot?.querySelectorAll('button') ?? [])].find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  if (!found) throw new Error(`No button "${text}"`);
  return found;
}

const offlineStatus = (player: SavannaPlayer): string =>
  player.shadowRoot?.querySelector('#offline-status')?.textContent?.trim() ?? '';

/** happy-dom has no service worker support, so tests install a stand-in. */
function stubServiceWorker(register = vi.fn(async () => ({}))) {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register, ready: Promise.resolve({}) },
  });
  return register;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('<savanna-player> offline controls (spec 4.6)', () => {
  it('hides the controls when the browser cannot store lessons offline', async () => {
    stubApi();
    const player = await mount();
    expect(player.shadowRoot?.querySelector('.offline')).toBeNull();
  });

  it('offers audio, text and full downloads as labelled buttons', async () => {
    stubApi();
    const player = await mount(fakeManager());
    const labels = [...(player.shadowRoot?.querySelectorAll('.offline-btn') ?? [])].map((b) =>
      b.textContent?.trim(),
    );
    expect(labels).toEqual(['Download audio only', 'Download text only', 'Download everything']);
    expect(player.shadowRoot?.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(
      'Offline use',
    );
  });

  it('downloads the package for the chosen mode and announces the result', async () => {
    stubApi();
    stubServiceWorker();
    const manager = fakeManager();
    const player = await mount(manager);
    button(player, 'Download audio only').click();
    await vi.waitFor(() => expect(offlineStatus(player)).toContain('Downloaded for offline use'));
    expect(manager.download).toHaveBeenCalledWith(offlinePackage, 'audio', expect.any(Function));
    expect(player.shadowRoot?.querySelector('#offline-status')?.getAttribute('role')).toBe(
      'status',
    );
  });

  it('registers the service worker from the host origin after a download', async () => {
    stubApi();
    const register = stubServiceWorker();
    const player = await mount(fakeManager());
    button(player, 'Download everything').click();
    await vi.waitFor(() => expect(offlineStatus(player)).toContain('Downloaded for offline use'));
    expect(register).toHaveBeenCalledWith('/savanna-sw.js');
  });

  it('uses the sw-url attribute when the host serves the worker elsewhere', async () => {
    stubApi();
    const register = stubServiceWorker();
    const player = document.createElement('savanna-player');
    player.setAttribute('sw-url', '/demo/savanna-sw.js');
    player.offlineManager = fakeManager() as unknown as DownloadManager;
    player.setAttribute('lesson-id', 'networking-101');
    player.setAttribute('api-base', 'https://api.example');
    document.body.append(player);
    await vi.waitFor(() => expect(player.status).toBe('ready'));
    await player.updateComplete;
    button(player, 'Download audio only').click();
    await vi.waitFor(() => expect(register).toHaveBeenCalledWith('/demo/savanna-sw.js'));
  });

  it('warns the learner when offline playback is not set up on the site', async () => {
    stubApi();
    stubServiceWorker(vi.fn(async () => Promise.reject(new Error('blocked'))));
    const player = await mount(fakeManager());
    button(player, 'Download audio only').click();
    await vi.waitFor(() =>
      expect(offlineStatus(player)).toContain('has not set up offline playback'),
    );
  });

  it('tells the learner when a download fails and keeps the buttons usable', async () => {
    stubApi();
    const manager = fakeManager();
    manager.download.mockRejectedValueOnce(new Error('network'));
    const player = await mount(manager);
    button(player, 'Download text only').click();
    await vi.waitFor(() => expect(offlineStatus(player)).toContain('The download failed'));
    expect(button(player, 'Download text only').getAttribute('aria-disabled')).toBe('false');
  });

  it('shows a remove button for a lesson that is already downloaded', async () => {
    stubApi();
    const manager = fakeManager('downloaded');
    const player = await mount(manager);
    await vi.waitFor(() => expect(offlineStatus(player)).toBe('Available offline: audio only.'));
    expect(player.shadowRoot?.querySelector('.offline-badge')?.textContent?.trim()).toBe(
      'Available offline: audio only.',
    );
    button(player, 'Remove download').click();
    await vi.waitFor(() => expect(offlineStatus(player)).toBe('Offline copy removed.'));
    expect(player.shadowRoot?.querySelector('.offline-badge')).toBeNull();
    expect(manager.remove).toHaveBeenCalledWith('networking-101');
  });

  it('shows the file name and percent until the download finishes', async () => {
    stubApi();
    stubServiceWorker();
    const manager = fakeManager();
    let finish = (): void => {};
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    manager.download.mockImplementation(
      async (_pkg: unknown, _mode: unknown, onProgress?: (progress: DownloadProgress) => void) => {
        onProgress?.({
          lessonId: 'networking-101',
          status: 'downloading',
          completedBytes: 50,
          totalBytes: 0,
          percent: 50,
          currentFile: 'networking-101.mp3',
        });
        await gate;
      },
    );
    const player = await mount(manager);
    button(player, 'Download audio only').click();
    await vi.waitFor(() =>
      expect(offlineStatus(player)).toBe('Downloading networking-101.mp3. 50%.'),
    );
    expect(player.shadowRoot?.querySelector('.offline-progress')?.getAttribute('value')).toBe('50');
    finish();
    await vi.waitFor(() => expect(offlineStatus(player)).toContain('Downloaded for offline use'));
    expect(player.shadowRoot?.querySelector('.offline-badge')?.textContent?.trim()).toBe(
      'Available offline: audio only.',
    );
    expect(player.shadowRoot?.querySelector('.retry-btn')).toBeNull();
  });

  it('retries a failed download once, with the same mode', async () => {
    stubApi();
    stubServiceWorker();
    const manager = fakeManager();
    manager.download.mockRejectedValueOnce(new Error('network'));
    const player = await mount(manager);
    button(player, 'Download text only').click();
    await vi.waitFor(() => expect(offlineStatus(player)).toContain('The download failed'));
    button(player, 'Retry').click();
    await vi.waitFor(() => expect(manager.download).toHaveBeenCalledTimes(2));
    expect(manager.download).toHaveBeenLastCalledWith(offlinePackage, 'text', expect.any(Function));
    await vi.waitFor(() => expect(offlineStatus(player)).toContain('Downloaded for offline use'));
    expect(player.shadowRoot?.querySelector('.retry-btn')).toBeNull();
  });
});
