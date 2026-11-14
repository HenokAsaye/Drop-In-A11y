import type { TranscriptSegment } from '@savanna/contracts';

/** Index of the segment being spoken at `time`, or -1 if none. Segments are ordered by start. */
export function findActiveSegment(_segments: TranscriptSegment[], _time: number): number {
  throw new Error('Not implemented: findActiveSegment');
}

/** Indexes of segments whose text matches `query` (case-insensitive, Unicode-aware). */
export function searchSegments(_segments: TranscriptSegment[], _query: string): number[] {
  throw new Error('Not implemented: searchSegments');
}
