import { webUrl, type LessonDocument } from '@savanna/contracts';
import { css, html, nothing, type TemplateResult } from 'lit';

export interface LessonDocumentLink {
  title: string;
  language: string;
  html: string | null;
  pdf: string | null;
}

const HEADING_ID = 'lesson-documents-heading';

/** Documents that have a title and at least one http(s) copy, with relative URLs resolved. */
export function lessonDocumentLinks(
  documents: readonly LessonDocument[] | null | undefined,
  baseHref: string,
): LessonDocumentLink[] {
  const links: LessonDocumentLink[] = [];
  for (const item of documents ?? []) {
    const title = item.title?.trim() ?? '';
    if (title === '') continue;
    const htmlUrl = webUrl(item.html, baseHref);
    const pdfUrl = webUrl(item.pdf, baseHref);
    if (htmlUrl === null && pdfUrl === null) continue;
    links.push({ title, language: item.language?.trim() ?? '', html: htmlUrl, pdf: pdfUrl });
  }
  return links;
}

export function renderLessonDocuments(
  links: readonly LessonDocumentLink[],
  headingId = HEADING_ID,
): TemplateResult | typeof nothing {
  if (links.length === 0) return nothing;
  return html`
    <nav class="lesson-documents" aria-labelledby=${headingId}>
      <h2 id=${headingId}>Lesson documents</h2>
      <ul>
        ${links.map(renderDocument)}
      </ul>
    </nav>
  `;
}

function renderDocument(link: LessonDocumentLink): TemplateResult {
  const language = link.language === '' ? nothing : link.language;
  return html`
    <li>
      ${renderCopy(link.html, `${link.title}, HTML`, language)}
      ${renderCopy(link.pdf, `${link.title}, PDF`, language)}
    </li>
  `;
}

function renderCopy(
  href: string | null,
  name: string,
  language: string | typeof nothing,
): TemplateResult | typeof nothing {
  return href === null ? nothing : html`<a href=${href} lang=${language}>${name}</a>`;
}

export const lessonDocumentStyles = css`
  .lesson-documents {
    margin: 0;
    padding: 0.75rem 0.5rem;
    border-top: 1px solid rgba(148, 163, 184, 0.4);
    background: rgba(15, 23, 42, 0.95);
    color: #f8fafc;
    min-width: 0;
  }

  .lesson-documents h2 {
    margin: 0 0 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.4;
  }

  .lesson-documents ul {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0;
    padding: 0;
    list-style: none;
    min-width: 0;
  }

  .lesson-documents li {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    min-width: 0;
  }

  .lesson-documents a {
    display: inline-flex;
    align-items: center;
    min-height: 2.5rem;
    min-width: 0;
    color: #f8fafc;
    overflow-wrap: anywhere;
    text-underline-offset: 0.15em;
  }
`;
