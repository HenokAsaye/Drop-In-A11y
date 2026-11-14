import type { DownloadManager } from '@savanna/offline';
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

function fakeManager(initial: 'downloaded' | 'not-downloaded' = 'not-downloaded') {
  return {
    download: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    status: vi.fn(async () => initial),
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

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
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
    const manager = fakeManager();
    const player = await mount(manager);
    button(player, 'Download audio only').click();
    await vi.waitFor(() => expect(offlineStatus(player)).toContain('Downloaded for offline use'));
    expect(manager.download).toHaveBeenCalledWith(offlinePackage, 'audio', expect.any(Function));
    expect(player.shadowRoot?.querySelector('#offline-status')?.getAttribute('role')).toBe(
      'status',
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
    await vi.waitFor(() => expect(offlineStatus(player)).toBe('This lesson is available offline.'));
    button(player, 'Remove download').click();
    await vi.waitFor(() => expect(offlineStatus(player)).toBe('Offline copy removed.'));
    expect(manager.remove).toHaveBeenCalledWith('networking-101');
  });
});
