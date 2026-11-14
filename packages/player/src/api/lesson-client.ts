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

  getLesson(_lessonId: string, _signal?: AbortSignal): Promise<Lesson> {
    throw new Error('Not implemented: LessonClient.getLesson');
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
