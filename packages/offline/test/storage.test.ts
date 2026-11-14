import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';

import { OfflineStorage, cacheNameFor, type StoredLesson } from '../src/storage';

const lesson: StoredLesson = {
  lessonId: 'networking-101',
  version: 'v1',
  mode: 'audio',
  sizeBytes: 4096,
  downloadedAt: '2026-11-14T10:00:00.000Z',
  package: { lessonId: 'networking-101', version: 'v1', resources: [] },
};

describe('offline storage (spec 4.6)', () => {
  it('versions cache names so updated lessons never serve stale files', () => {
    expect(cacheNameFor('networking-101', 'v2')).toBe('savanna-lesson:networking-101:v2');
  });

  it('records downloaded lessons in IndexedDB', async () => {
    const storage = new OfflineStorage('test-db-records');
    await storage.put(lesson);
    expect(await storage.get('networking-101')).toEqual(lesson);
  });

  it.todo('lists downloaded lessons with their size and mode');
  it.todo('deleting a lesson removes its IndexedDB entry and Cache API files');
});

describe('download manager (spec 4.6)', () => {
  it.todo('downloads audio, transcripts, lightweight HTML and documents for the chosen mode');
  it.todo('reports progress in bytes');
  it.todo('marks a download failed and cleans up partial files on network error');
  it.todo('re-downloads when the package version changes');
});

describe('service worker (spec 4.6)', () => {
  it.todo('serves downloaded lesson resources cache-first');
  it.todo('the offline lesson page works after disconnecting (Playwright e2e)');
});
