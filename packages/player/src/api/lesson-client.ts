import {
  API_VERSION_PREFIX,
  type CaptionTrack,
  type Lesson,
  type LessonDocument,
  type OfflinePackage,
  type Transcript,
} from '@savanna/contracts';

import { LESSON_LOAD_FAILURE_MESSAGE } from '../config';

/** A lesson request failed with a message safe to show to a learner. */
export class LessonRequestError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LessonRequestError';
  }
}

/** Thin client for the BridgePlayer API. Media bytes are fetched by the browser, not by this client. */
export class LessonClient {
  constructor(
    protected readonly apiBase: string,
    protected readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  getLesson(lessonId: string, signal?: AbortSignal): Promise<Lesson> {
    return this.request(this.lessonPath(lessonId), signal);
  }

  getTranscript(lessonId: string, language: string): Promise<Transcript> {
    const query = new URLSearchParams({ language });
    return this.request(`${this.lessonPath(lessonId)}/transcript?${query}`);
  }

  getCaptions(lessonId: string): Promise<CaptionTrack[]> {
    return this.request(`${this.lessonPath(lessonId)}/captions`);
  }

  getOfflinePackage(lessonId: string): Promise<OfflinePackage> {
    return this.request(`${this.lessonPath(lessonId)}/offline`);
  }

  getDocuments(lessonId: string): Promise<LessonDocument[]> {
    return this.request(`${this.lessonPath(lessonId)}/documents`);
  }

  private lessonPath(lessonId: string): string {
    return `${API_VERSION_PREFIX}/lessons/${encodeURIComponent(lessonId)}`;
  }

  private endpoint(path: string): string {
    let base: URL;
    try {
      base = new URL(this.apiBase.trim());
    } catch (cause) {
      throw new LessonRequestError(LESSON_LOAD_FAILURE_MESSAGE, { cause });
    }
    const prefix = base.href.endsWith('/') ? base.href : `${base.href}/`;
    return new URL(path.replace(/^\/+/, ''), prefix).href;
  }

  private async request<T>(path: string, signal?: AbortSignal): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint(path), {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal,
      });
    } catch (cause) {
      if (isAbortError(cause)) throw cause;
      throw new LessonRequestError(LESSON_LOAD_FAILURE_MESSAGE, { cause });
    }

    if (!response.ok) {
      throw new LessonRequestError(await readErrorMessage(response));
    }

    try {
      return (await response.json()) as T;
    } catch (cause) {
      if (isAbortError(cause)) throw cause;
      throw new LessonRequestError(LESSON_LOAD_FAILURE_MESSAGE, { cause });
    }
  }
}

function isAbortError(error: unknown): boolean {
  return isNamed(error, 'AbortError');
}

function isNamed(error: unknown, name: string): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === name;
}

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = `${LESSON_LOAD_FAILURE_MESSAGE} (${response.status}).`;
  try {
    const body: unknown = await response.json();
    if (!isRecord(body) || typeof body.detail !== 'string') return fallback;
    const detail = body.detail.trim();
    return detail === '' ? fallback : detail;
  } catch {
    return fallback;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
