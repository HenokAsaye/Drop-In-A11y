import type { TranscriptSegment } from '@savanna/contracts';

/** Index of the segment being spoken at `time`, or -1 if none. Segments are ordered by start. */
export function findActiveSegment(segments: TranscriptSegment[], time: number): number {
  let match = -1;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment === undefined || time < segment.start || time > segment.end) continue;
    if (match === -1 || segment.start >= (segments[match]?.start ?? -Infinity)) match = index;
  }
  return match;
}

/** Indexes of segments whose text matches `query` (case-insensitive, Unicode-aware). */
export function searchSegments(segments: TranscriptSegment[], query: string): number[] {
  const needle = fold(query).trim();
  if (needle === '') return [];
  const hits: number[] = [];
  segments.forEach((segment, index) => {
    if (fold(segment.text).includes(needle)) hits.push(index);
  });
  return hits;
}

function fold(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase();
}
