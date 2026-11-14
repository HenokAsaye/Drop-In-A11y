import type { OfflinePackage } from '@savanna/contracts';

import type { OfflineMode, OfflineStorage } from './storage';

export type DownloadStatus = 'not-downloaded' | 'downloading' | 'downloaded' | 'failed';

export interface DownloadProgress {
  lessonId: string;
  status: DownloadStatus;
  completedBytes: number;
  totalBytes: number;
}

/** Downloads an offline package (audio, transcripts, lightweight HTML, documents) into the Cache API. */
export class DownloadManager {
  constructor(protected readonly storage: OfflineStorage) {}

  download(
    _pkg: OfflinePackage,
    _mode: OfflineMode,
    _onProgress?: (progress: DownloadProgress) => void,
  ): Promise<void> {
    throw new Error('Not implemented: DownloadManager.download');
  }

  status(_lessonId: string): Promise<DownloadStatus> {
    throw new Error('Not implemented: DownloadManager.status');
  }

  remove(_lessonId: string): Promise<void> {
    throw new Error('Not implemented: DownloadManager.remove');
  }
}
