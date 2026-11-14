import { describe, expect, it } from 'vitest';

import { matchLessonResource } from '../src/lesson-cache';

const URL = 'http://m/a.mp3';

/** Fake CacheStorage holding the given files per cache name. */
function fakeCaches(content: Record<string, Record<string, string>>): CacheStorage {
  return {
    keys: async () => Object.keys(content),
    open: async (name: string) => ({
      match: async (url: string) => {
        const body = content[name]?.[url];
        return body === undefined
          ? undefined
          : new Response(body, { headers: { 'Content-Type': 'audio/mpeg' } });
      },
    }),
  } as unknown as CacheStorage;
}

const downloaded = fakeCaches({ 'savanna-lesson:networking-101:v1': { [URL]: '0123456789' } });

describe('service worker (spec 4.6)', () => {
  it('serves downloaded lesson resources cache-first', async () => {
    const response = await matchLessonResource(new Request(URL), downloaded);
    expect(await response?.text()).toBe('0123456789');
  });

  it('ignores files that were not downloaded and caches that are not lesson caches', async () => {
    expect(
      await matchLessonResource(new Request('http://m/other.mp3'), downloaded),
    ).toBeUndefined();
    const hostCache = fakeCaches({ 'host-assets': { [URL]: 'nope' } });
    expect(await matchLessonResource(new Request(URL), hostCache)).toBeUndefined();
  });

  it('leaves non-GET requests to the network', async () => {
    const post = new Request(URL, { method: 'POST', body: 'x' });
    expect(await matchLessonResource(post, downloaded)).toBeUndefined();
  });

  it('answers byte-range requests with 206 so audio can seek offline', async () => {
    const request = new Request(URL, { headers: { Range: 'bytes=2-5' } });
    const response = await matchLessonResource(request, downloaded);
    expect(response?.status).toBe(206);
    expect(response?.headers.get('Content-Range')).toBe('bytes 2-5/10');
    expect(await response?.text()).toBe('2345');
  });
});
