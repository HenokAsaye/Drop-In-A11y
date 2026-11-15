import type { Lesson, LessonDocument } from '@savanna/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import '../src/components/savanna-player';
import type { SavannaPlayer } from '../src/components/savanna-player';

const notes = {
  title: 'Networking Notes',
  language: 'en',
  html: 'https://media.example/documents/networking-101-notes.html',
  pdf: 'https://media.example/documents/networking-101-notes.pdf',
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('lesson documents (spec 4.7)', () => {
  it('lists the HTML and PDF with descriptive names', async () => {
    const player = await mount({
      id: 'networking-101',
      title: 'Introduction to Networking',
      documents: [notes],
    });

    const nav = player.shadowRoot?.querySelector('nav.lesson-documents');
    expect(nav?.getAttribute('aria-labelledby')).toBe('lesson-documents-heading');
    expect(nav?.querySelector('h2')?.textContent).toBe('Lesson documents');

    const links = [...(nav?.querySelectorAll('a') ?? [])];
    expect(links.map((link) => link.textContent)).toEqual([
      'Networking Notes, HTML',
      'Networking Notes, PDF',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([notes.html, notes.pdf]);
    expect(links.every((link) => link.getAttribute('lang') === 'en')).toBe(true);
  });

  it('omits a document that has no http address', async () => {
    const player = await mount({
      id: 'networking-101',
      title: 'Introduction to Networking',
      documents: [
        { title: 'Broken', language: 'en', html: 'javascript:alert(1)', pdf: null },
        { title: 'PDF only', language: 'am', html: '   ', pdf: '/documents/notes.pdf' },
      ],
    });

    const links = [...(player.shadowRoot?.querySelectorAll('nav.lesson-documents a') ?? [])];
    expect(links).toHaveLength(1);
    expect(links[0]?.textContent).toBe('PDF only, PDF');
    expect(links[0]?.getAttribute('lang')).toBe('am');
    expect(links[0]?.getAttribute('href')).toBe(
      new URL('/documents/notes.pdf', document.baseURI).href,
    );
  });

  it('does not render the list when the lesson has no documents', async () => {
    const player = await mount({
      id: 'networking-101',
      title: 'Introduction to Networking',
      documents: [],
    });

    expect(player.shadowRoot?.querySelector('nav.lesson-documents')).toBeNull();
  });
});

async function mount(lesson: {
  id: string;
  title: string;
  documents: LessonDocument[];
}): Promise<SavannaPlayer> {
  const player = document.createElement('savanna-player');
  document.body.append(player);
  await player.updateComplete;
  const loaded: Lesson = {
    id: lesson.id,
    title: lesson.title,
    description: 'Learn the fundamentals of computer networking.',
    language: 'en',
    media: {
      video: 'https://media.example/video.mp4',
      audio: null,
      signLanguage: null,
      audioDescription: null,
      poster: null,
    },
    captions: [],
    transcripts: [],
    documents: lesson.documents,
  };
  player.lesson = loaded;
  await player.updateComplete;
  return player;
}
