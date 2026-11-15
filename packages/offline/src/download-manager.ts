import type { OfflinePackage, OfflineResource } from '@savanna/contracts';

import { cacheNameFor, type OfflineMode, type OfflineStorage, type StoredLesson } from './storage';

function percentComplete(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

function fileNameOf(url: string | undefined): string {
  if (!url) return '';
  try {
    const name = new URL(url).pathname.split('/').pop() ?? '';
    return name === '' ? url : decodeURIComponent(name);
  } catch {
    return url;
  }
}

export type DownloadStatus = 'not-downloaded' | 'downloading' | 'downloaded' | 'failed';

export interface DownloadProgress {
  lessonId: string;
  status: DownloadStatus;
  completedBytes: number;
  totalBytes: number;
  /** 0–100, based on how many package files have been saved. */
  percent: number;
  /** File currently being saved, or empty when the download is not on a file. */
  currentFile: string;
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
    const report = (
      status: DownloadStatus,
      completedBytes: number,
      totalBytes = 0,
      currentFile = '',
      percent = 0,
    ): void => {
      this.inFlightOrFailed.set(lessonId, status);
      onProgress?.({ lessonId, status, completedBytes, totalBytes, currentFile, percent });
    };

    if (existing?.version === pkg.version && existing.mode === mode) {
      this.inFlightOrFailed.delete(lessonId);
      onProgress?.({
        lessonId,
        status: 'downloaded',
        completedBytes: existing.sizeBytes,
        totalBytes: existing.sizeBytes,
        currentFile: '',
        percent: 100,
      });
      return;
    }
    if (existing && existing.version !== pkg.version) {
      await this.caches.delete(cacheNameFor(lessonId, existing.version));
    }

    const cacheName = cacheNameFor(lessonId, pkg.version);
    const wanted = pkg.resources.filter((r) => MODE_RESOURCE_TYPES[mode].includes(r.type));
    let completedBytes = 0;
    const totalFiles = wanted.length;
    report('downloading', 0, 0, fileNameOf(wanted[0]?.url), 0);
    try {
      const cache = await this.caches.open(cacheName);
      for (const [index, resource] of wanted.entries()) {
        const response = await this.fetcher(resource.url);
        if (!response.ok) throw new Error(`Download failed (${response.status}): ${resource.url}`);
        completedBytes += (await response.clone().arrayBuffer()).byteLength;
        await cache.put(resource.url, response);
        const next = wanted[index + 1];
        report(
          'downloading',
          completedBytes,
          0,
          fileNameOf(next?.url ?? resource.url),
          percentComplete(index + 1, totalFiles),
        );
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
    onProgress?.({
      lessonId,
      status: 'downloaded',
      completedBytes,
      totalBytes: completedBytes,
      currentFile: '',
      percent: 100,
    });
  }

  /** The saved package, when this lesson is stored on the device. */
  async record(lessonId: string): Promise<StoredLesson | undefined> {
    return this.storage.get(lessonId);
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
