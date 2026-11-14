import type {
  CaptionTrack,
  Lesson,
  LessonDocument,
  OfflinePackage,
  Transcript,
} from '@savanna/contracts';

/** Thin client for the BridgePlayer API. Media bytes are fetched by the browser, not by this client. */
export class LessonClient {
  constructor(
    protected readonly apiBase: string,
    protected readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  async getLesson(lessonId: string, signal?: AbortSignal): Promise<Lesson> {
    const base = this.apiBase.replace(/\/+$/, '');
    const url = `${base}/api/v1/lessons/${encodeURIComponent(lessonId)}`;
    const response = await this.fetchImpl(url, { signal });
    if (!response.ok) {
      throw new Error(
        `Failed to load lesson '${lessonId}': ${response.status} ${response.statusText}`,
      );
    }
    return (await response.json()) as Lesson;
  }

  getTranscript(_lessonId: string, _language: string): Promise<Transcript> {
    throw new Error('Not implemented: LessonClient.getTranscript');
  }

  getCaptions(_lessonId: string): Promise<CaptionTrack[]> {
    throw new Error('Not implemented: LessonClient.getCaptions');
  }

  getOfflinePackage(_lessonId: string): Promise<OfflinePackage> {
    throw new Error('Not implemented: LessonClient.getOfflinePackage');
  }

  getDocuments(_lessonId: string): Promise<LessonDocument[]> {
    throw new Error('Not implemented: LessonClient.getDocuments');
  }
}
