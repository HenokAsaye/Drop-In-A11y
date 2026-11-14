import 'fake-indexeddb/auto';
import type { OfflinePackage } from '@savanna/contracts';
import { describe, expect, it } from 'vitest';

import { DownloadManager, type DownloadProgress } from '../src/download-manager';
import { OfflineStorage, cacheNameFor } from '../src/storage';

/** In-memory stand-in for the browser's Cache API (happy-dom does not provide one). */
function fakeCaches(): CacheStorage {
  const stores = new Map<string, Map<string, Response>>();
  return {
    open: async (name: string) => {
      const store = stores.get(name) ?? new Map<string, Response>();
      stores.set(name, store);
      return {
        put: async (url: string, response: Response) => void store.set(url, response),
        keys: async () => [...store.keys()].map((url) => ({ url })),
      };
    },
    delete: async (name: string) => stores.delete(name),
    has: async (name: string) => stores.has(name),
  } as unknown as CacheStorage;
}

function pkg(version = 'v1'): OfflinePackage {
  return {
    lessonId: 'networking-101',
    version,
    resources: [
      { type: 'audio', url: 'http://m/a.mp3' },
      { type: 'transcript', url: 'http://m/t-en.json', language: 'en' },
      { type: 'captions', url: 'http://m/c-en.vtt', language: 'en' },
      { type: 'html', url: 'http://m/notes.html' },
      { type: 'document', url: 'http://m/notes.pdf' },
    ],
  };
}

function setup(failOn?: string) {
  const caches = fakeCaches();
  const fetched: string[] = [];
  const fetchFake = (async (url: string) => {
    fetched.push(url);
    if (url === failOn) return new Response('boom', { status: 500 });
    return new Response('x'.repeat(100));
  }) as unknown as typeof fetch;
  const storage = new OfflineStorage(`dm-${Math.random()}`);
  return {
    caches,
    fetched,
    storage,
    manager: new DownloadManager(storage, { caches, fetch: fetchFake }),
  };
}

async function cachedUrls(caches: CacheStorage, version = 'v1'): Promise<string[]> {
  const cache = await caches.open(cacheNameFor('networking-101', version));
  return (await cache.keys()).map((request) => request.url).sort();
}

describe('download manager (spec 4.6)', () => {
  it('downloads audio, transcripts, lightweight HTML and documents for the chosen mode', async () => {
    const audio = setup();
    await audio.manager.download(pkg(), 'audio');
    expect(await cachedUrls(audio.caches)).toEqual(['http://m/a.mp3']);

    const text = setup();
    await text.manager.download(pkg(), 'text');
    expect(await cachedUrls(text.caches)).toEqual([
      'http://m/c-en.vtt',
      'http://m/notes.html',
      'http://m/notes.pdf',
      'http://m/t-en.json',
    ]);

    const full = setup();
    await full.manager.download(pkg(), 'full');
    expect(await cachedUrls(full.caches)).toHaveLength(5);
    expect(await full.manager.status('networking-101')).toBe('downloaded');
  });

  it('reports progress in bytes', async () => {
    const { manager } = setup();
    const events: DownloadProgress[] = [];
    await manager.download(pkg(), 'text', (progress) => events.push(progress));
    const bytes = events.map((event) => event.completedBytes);
    expect(bytes).toEqual([0, 100, 200, 300, 400, 400]);
    expect(events.at(-1)).toMatchObject({ status: 'downloaded', totalBytes: 400 });
  });

  it('marks a download failed and cleans up partial files on network error', async () => {
    const { manager, caches, storage } = setup('http://m/notes.html');
    await expect(manager.download(pkg(), 'text')).rejects.toThrow('Download failed (500)');
    expect(await caches.has(cacheNameFor('networking-101', 'v1'))).toBe(false);
    expect(await storage.get('networking-101')).toBeUndefined();
    expect(await manager.status('networking-101')).toBe('failed');
  });

  it('re-downloads when the package version changes', async () => {
    const { manager, caches, storage, fetched } = setup();
    await manager.download(pkg('v1'), 'audio');
    await manager.download(pkg('v1'), 'audio');
    expect(fetched).toHaveLength(1);

    await manager.download(pkg('v2'), 'audio');
    expect(fetched).toHaveLength(2);
    expect(await caches.has(cacheNameFor('networking-101', 'v1'))).toBe(false);
    expect(await caches.has(cacheNameFor('networking-101', 'v2'))).toBe(true);
    expect((await storage.get('networking-101'))?.version).toBe('v2');
  });

  it('removes the cached files and the index entry', async () => {
    const { manager, caches, storage } = setup();
    await manager.download(pkg(), 'audio');
    await manager.remove('networking-101');
    expect(await caches.has(cacheNameFor('networking-101', 'v1'))).toBe(false);
    expect(await storage.get('networking-101')).toBeUndefined();
    expect(await manager.status('networking-101')).toBe('not-downloaded');
  });
});
