import { OFFLINE_CACHE_PREFIX } from './storage';

/** Answers `Range: bytes=start-end` from a full response, as the network would (206). */
async function sliceRange(response: Response, range: string): Promise<Response> {
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) return response;
  const bytes = await response.clone().arrayBuffer();
  const total = bytes.byteLength;
  const start = match[1] ? Number(match[1]) : Math.max(total - Number(match[2]), 0);
  const end = match[1] && match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
  if (start >= total || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
  }
  return new Response(bytes.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': String(end - start + 1),
    },
  });
}

/**
 * Looks for a downloaded lesson file for this request. Only caches named `savanna-lesson:*`
 * are searched, so the host site's own caches are never touched. Returns undefined when the
 * request is not a GET or the file was not downloaded, so the caller can use the network.
 */
export async function matchLessonResource(
  request: Request,
  caches: CacheStorage,
): Promise<Response | undefined> {
  if (request.method !== 'GET') return undefined;
  for (const name of await caches.keys()) {
    if (!name.startsWith(`${OFFLINE_CACHE_PREFIX}:`)) continue;
    const cached = await (await caches.open(name)).match(request.url);
    if (!cached) continue;
    const range = request.headers.get('Range');
    return range ? sliceRange(cached, range) : cached;
  }
  return undefined;
}
