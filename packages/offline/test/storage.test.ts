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

  it('lists downloaded lessons with their size and mode', async () => {
    const storage = new OfflineStorage('test-db-list');
    expect(await storage.list()).toEqual([]);
    await storage.put(lesson);
    await storage.put({ ...lesson, lessonId: 'html-101', mode: 'text', sizeBytes: 512 });
    const listed = await storage.list();
    expect(listed.map((item) => [item.lessonId, item.mode, item.sizeBytes]).sort()).toEqual([
      ['html-101', 'text', 512],
      ['networking-101', 'audio', 4096],
    ]);
  });

  it('replaces the entry when the same lesson is stored again', async () => {
    const storage = new OfflineStorage('test-db-replace');
    await storage.put(lesson);
    await storage.put({ ...lesson, version: 'v2' });
    expect(await storage.list()).toHaveLength(1);
    expect((await storage.get('networking-101'))?.version).toBe('v2');
  });

  it('deleting a lesson removes its IndexedDB entry', async () => {
    const storage = new OfflineStorage('test-db-delete');
    await storage.put(lesson);
    await storage.delete('networking-101');
    expect(await storage.get('networking-101')).toBeUndefined();
    expect(await storage.list()).toEqual([]);
  });
});

describe('service worker (spec 4.6)', () => {
  it.todo('the offline lesson page works after disconnecting (Playwright e2e)');
});
