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
export class OfflineStorage {
  constructor(protected readonly dbName = 'savanna-offline') {}

  get(_lessonId: string): Promise<StoredLesson | undefined> {
    throw new Error('Not implemented: OfflineStorage.get');
  }

  list(): Promise<StoredLesson[]> {
    throw new Error('Not implemented: OfflineStorage.list');
  }

  put(_lesson: StoredLesson): Promise<void> {
    throw new Error('Not implemented: OfflineStorage.put');
  }

  delete(_lessonId: string): Promise<void> {
    throw new Error('Not implemented: OfflineStorage.delete');
  }
}
