import type { LessonDocument } from '@savanna/contracts';

export interface LessonDocumentLink {
  title: string;
  language: string;
  html: string | null;
  pdf: string | null;
}

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

/** Absolute http(s) links for the documents a lesson already published. */
export function lessonDocumentLinks(
  documents: readonly LessonDocument[] | null | undefined,
  baseHref: string,
): LessonDocumentLink[] {
  if (!documents) return [];
  const links: LessonDocumentLink[] = [];
  for (const document of documents) {
    const title = document.title?.trim() ?? '';
    if (title === '') continue;
    const html = httpUrl(document.html, baseHref);
    const pdf = httpUrl(document.pdf, baseHref);
    if (html === null && pdf === null) continue;
    links.push({ title, language: document.language?.trim() ?? '', html, pdf });
  }
  return links;
}

function httpUrl(value: string | null | undefined, baseHref: string): string | null {
  const raw = value?.trim() ?? '';
  if (raw === '') return null;
  try {
    const url = new URL(raw, baseHref);
    if (!HTTP_PROTOCOLS.has(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}
