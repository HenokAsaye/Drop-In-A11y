import type { OfflinePackage, OfflineResource } from '@savanna/contracts';

import { cacheNameFor, type OfflineMode, type OfflineStorage } from './storage';

export type DownloadStatus = 'not-downloaded' | 'downloading' | 'downloaded' | 'failed';

export interface DownloadProgress {
  lessonId: string;
  status: DownloadStatus;
  completedBytes: number;
  totalBytes: number;
}

/** Browser APIs the manager needs; tests pass fakes, the browser uses the globals. */
export interface DownloadDeps {
  caches: CacheStorage;
  fetch: typeof fetch;
}

/** Which resource types each mode downloads. `full` is everything in the package. */
export const MODE_RESOURCE_TYPES: Record<OfflineMode, OfflineResource['type'][]> = {
  audio: ['audio'],
  text: ['transcript', 'captions', 'html', 'document'],
  full: ['audio', 'transcript', 'captions', 'html', 'document'],
};

/** Downloads an offline package (audio, transcripts, lightweight HTML, documents) into the Cache API. */
export class DownloadManager {
  private readonly inFlightOrFailed = new Map<string, DownloadStatus>();

  constructor(
    protected readonly storage: OfflineStorage,
    private readonly deps: Partial<DownloadDeps> = {},
  ) {}

  private get caches(): CacheStorage {
    return this.deps.caches ?? globalThis.caches;
  }

  private get fetcher(): typeof fetch {
    return this.deps.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async download(
    pkg: OfflinePackage,
    mode: OfflineMode,
    onProgress?: (progress: DownloadProgress) => void,
  ): Promise<void> {
    const lessonId = pkg.lessonId;
    const existing = await this.storage.get(lessonId);
    const report = (status: DownloadStatus, completedBytes: number, totalBytes = 0): void => {
      this.inFlightOrFailed.set(lessonId, status);
      onProgress?.({ lessonId, status, completedBytes, totalBytes });
    };

    if (existing?.version === pkg.version && existing.mode === mode) {
      this.inFlightOrFailed.delete(lessonId);
      onProgress?.({
        lessonId,
        status: 'downloaded',
        completedBytes: existing.sizeBytes,
        totalBytes: existing.sizeBytes,
      });
      return;
    }
    if (existing && existing.version !== pkg.version) {
      await this.caches.delete(cacheNameFor(lessonId, existing.version));
    }

    const cacheName = cacheNameFor(lessonId, pkg.version);
    const wanted = pkg.resources.filter((r) => MODE_RESOURCE_TYPES[mode].includes(r.type));
    let completedBytes = 0;
    report('downloading', 0);
    try {
      const cache = await this.caches.open(cacheName);
      for (const resource of wanted) {
        const response = await this.fetcher(resource.url);
        if (!response.ok) throw new Error(`Download failed (${response.status}): ${resource.url}`);
        completedBytes += (await response.clone().arrayBuffer()).byteLength;
        await cache.put(resource.url, response);
        report('downloading', completedBytes);
      }
      await this.storage.put({
        lessonId,
        version: pkg.version,
        mode,
        sizeBytes: completedBytes,
        downloadedAt: new Date().toISOString(),
        package: pkg,
      });
    } catch (error) {
      await this.caches.delete(cacheName);
      report('failed', completedBytes);
      throw error;
    }
    this.inFlightOrFailed.delete(lessonId);
    onProgress?.({ lessonId, status: 'downloaded', completedBytes, totalBytes: completedBytes });
  }

  async status(lessonId: string): Promise<DownloadStatus> {
    const pending = this.inFlightOrFailed.get(lessonId);
    if (pending) return pending;
    return (await this.storage.get(lessonId)) ? 'downloaded' : 'not-downloaded';
  }

  async remove(lessonId: string): Promise<void> {
    const existing = await this.storage.get(lessonId);
    if (existing) await this.caches.delete(cacheNameFor(lessonId, existing.version));
    await this.storage.delete(lessonId);
    this.inFlightOrFailed.delete(lessonId);
  }
}
