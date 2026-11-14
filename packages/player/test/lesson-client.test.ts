import { describe, expect, it, vi } from 'vitest';

import { LessonClient, LessonRequestError } from '../src/api/lesson-client';

const lesson = {
  id: 'networking-101',
  title: 'Introduction to Networking',
  description: 'Learn the fundamentals of computer networking.',
  language: 'en',
  media: { video: 'https://media.example/networking-101.mp4' },
  captions: [],
  transcripts: [],
  documents: [],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('LessonClient', () => {
  it('requests each lesson resource from api-base', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/captions') || url.endsWith('/documents')) return jsonResponse([]);
      if (url.endsWith('/offline')) {
        return jsonResponse({ lessonId: 'networking-101', version: '1', resources: [] });
      }
      if (url.includes('/transcript?')) return jsonResponse({ language: 'am', segments: [] });
      return jsonResponse(lesson);
    });
    const client = new LessonClient('https://api.example/', fetchImpl);

    await expect(client.getLesson('networking-101')).resolves.toMatchObject({
      id: 'networking-101',
    });
    await client.getTranscript('networking-101', 'am');
    await client.getCaptions('networking-101');
    await client.getOfflinePackage('networking-101');
    await client.getDocuments('networking-101');

    expect(fetchImpl.mock.calls.map((call) => String(call[0]))).toEqual([
      'https://api.example/api/v1/lessons/networking-101',
      'https://api.example/api/v1/lessons/networking-101/transcript?language=am',
      'https://api.example/api/v1/lessons/networking-101/captions',
      'https://api.example/api/v1/lessons/networking-101/offline',
      'https://api.example/api/v1/lessons/networking-101/documents',
    ]);
  });

  it('encodes the lesson id', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe('https://api.example/api/v1/lessons/lesson%2F1');
      return jsonResponse(lesson);
    });
    const client = new LessonClient('https://api.example', fetchImpl);

    await client.getLesson('lesson/1');
  });

  it('uses the API error detail when a request fails', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        { detail: "Lesson 'missing' was not found", code: 'not_found', resource: 'Lesson' },
        404,
      ),
    );
    const client = new LessonClient('https://api.example', fetchImpl);

    await expect(client.getLesson('missing')).rejects.toBeInstanceOf(LessonRequestError);
    await expect(client.getLesson('missing')).rejects.toThrow("Lesson 'missing' was not found");
  });

  it('reports a readable message when the network fails', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const client = new LessonClient('https://api.example', fetchImpl);

    await expect(client.getLesson('networking-101')).rejects.toThrow(
      'The lesson could not be loaded.',
    );
  });

  it('passes an abort signal through without wrapping the abort', async () => {
    const signal = new AbortController().signal;
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBe(signal);
      throw new DOMException('The operation was aborted.', 'AbortError');
    });
    const client = new LessonClient('https://api.example', fetchImpl);

    await expect(client.getLesson('networking-101', signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
