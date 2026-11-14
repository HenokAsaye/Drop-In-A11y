import type { OfflinePackage } from '@savanna/contracts';

export const OFFLINE_CACHE_PREFIX = 'savanna-lesson';

export type OfflineMode = 'full' | 'audio' | 'text';

export interface StoredLesson {
  lessonId: string;
  version: string;
  mode: OfflineMode;
  sizeBytes: number;
  downloadedAt: string;
  package: OfflinePackage;
}

/** Cache name is versioned so a content change never serves stale lesson files. */
export function cacheNameFor(lessonId: string, version: string): string {
  return `${OFFLINE_CACHE_PREFIX}:${lessonId}:${version}`;
}

/** IndexedDB index of downloaded lessons; file bytes live in the Cache API. */
const STORE_NAME = 'lessons';

export class OfflineStorage {
  constructor(protected readonly dbName = 'savanna-offline') {}

  /** Opens the database, creating the `lessons` store (keyed by lessonId) on first use. */
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'lessonId' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /** Runs one request against the store and resolves with its result. */
  private async run<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.open();
    try {
      return await new Promise<T>((resolve, reject) => {
        const request = action(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  }

  get(lessonId: string): Promise<StoredLesson | undefined> {
    return this.run('readonly', (store) => store.get(lessonId));
  }

  list(): Promise<StoredLesson[]> {
    throw new Error('Not implemented: OfflineStorage.list');
  }

  async put(lesson: StoredLesson): Promise<void> {
    await this.run('readwrite', (store) => store.put(lesson));
  }

  delete(_lessonId: string): Promise<void> {
    throw new Error('Not implemented: OfflineStorage.delete');
  }
}
