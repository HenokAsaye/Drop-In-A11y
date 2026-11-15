import type { Lesson } from '@savanna/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../src/index';

function lessonBody(): Lesson {
  return {
    id: 'networking-101',
    title: 'Introduction to Networking',
    description: 'Learn the fundamentals of computer networking.',
    language: 'en',
    media: {
      video: 'https://media.example/video.mp4',
      audio: null,
      signLanguage: 'https://media.example/sign.mp4',
      audioDescription: null,
      poster: null,
    },
    captions: [],
    transcripts: [],
    documents: [
      {
        title: 'Networking Notes',
        language: 'en',
        html: 'https://media.example/notes.html',
        pdf: null,
      },
    ],
    chapters: [{ name: 'Welcome', start: 0 }],
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/transcript')) {
        return new Response(JSON.stringify({ language: 'en', segments: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(lessonBody()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
});

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('host CSS parts', () => {
  it('exposes toolbar, documents, and focus-ring, including nested exportparts', async () => {
    const player = document.createElement('savanna-player');
    player.setAttribute('exportparts', 'toolbar');
    player.setAttribute('lesson-id', 'networking-101');
    player.setAttribute('api-base', 'https://api.example');
    document.body.append(player);
    await vi.waitFor(() => expect(player.status).toBe('ready'));
    await player.updateComplete;

    expect(player.getAttribute('exportparts')).toBe('toolbar, focus-ring');
    expect(player.shadowRoot?.querySelector('.controls-toolbar')?.getAttribute('part')).toBe(
      'toolbar',
    );
    expect(player.shadowRoot?.querySelector('.play-btn')?.getAttribute('part')).toBe('focus-ring');
    expect(player.shadowRoot?.querySelector('.lesson-documents')?.getAttribute('part')).toBe(
      'documents',
    );
    expect(player.shadowRoot?.querySelector('.lesson-documents a')?.getAttribute('part')).toBe(
      'focus-ring',
    );
    expect(player.shadowRoot?.querySelector('.chapter-btn')?.getAttribute('part')).toBe(
      'focus-ring',
    );

    const transcript = player.shadowRoot?.querySelector('savanna-transcript');
    const sign = player.shadowRoot?.querySelector('savanna-sign-language');
    expect(transcript?.getAttribute('exportparts')).toBe('focus-ring');
    expect(sign?.getAttribute('exportparts')).toBe('focus-ring');
    expect(transcript?.shadowRoot?.querySelector('button')?.getAttribute('part')).toBe(
      'focus-ring',
    );
    expect(sign?.shadowRoot?.querySelector('.drag-handle')?.getAttribute('part')).toBe(
      'focus-ring',
    );
    expect(sign?.shadowRoot?.querySelector('.resize-handle')?.getAttribute('part')).toBe(
      'focus-ring',
    );
  });
});
