import type { TranscriptSegment } from '@savanna/contracts';

/** Plain-text transcript for the sentences currently on screen. Null when there is nothing to save. */
export function transcriptDocument(segments: readonly TranscriptSegment[]): string | null {
  const lines: string[] = [];
  for (const segment of segments) {
    const text = typeof segment?.text === 'string' ? segment.text.trim() : '';
    const start = segment?.start;
    if (text === '' || typeof start !== 'number' || !Number.isFinite(start) || start < 0) continue;
    lines.push(`${formatTimestamp(start)} ${text}`);
  }
  if (lines.length === 0) return null;
  return `${lines.join('\n')}\n`;
}

export function transcriptFilename(lessonId: string, language: string): string {
  const id = lessonId.trim().replace(/[^\w.-]+/g, '-') || 'lesson';
  const lang =
    language
      .trim()
      .toLowerCase()
      .replace(/[^\w.-]+/g, '') || 'txt';
  return `${id}-${lang}.txt`;
}

function formatTimestamp(seconds: number): string {
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
