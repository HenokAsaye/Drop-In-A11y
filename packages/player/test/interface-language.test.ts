import type { Lesson } from '@savanna/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../src/index';
import type { SavannaPlayer } from '../src/components/savanna-player';

const english = [{ start: 0, end: 4, text: 'Welcome to our networking lesson.' }];
const amharic = [{ start: 0, end: 4, text: 'እንኳን ወደ ኔትወርክ ትምህርታችን በደህና መጡ።' }];

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
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

async function mount(lang?: string): Promise<SavannaPlayer> {
  const player = document.createElement('savanna-player');
  player.setAttribute('lesson-id', 'networking-101');
  player.setAttribute('api-base', 'https://api.example');
  player.setAttribute('caption-language', 'en');
  if (lang !== undefined) player.setAttribute('lang', lang);
  document.body.append(player);
  await vi.waitFor(() => expect(player.status).toBe('ready'));
  await player.updateComplete;
  return player;
}

function labelled(player: SavannaPlayer, selector: string): string {
  return player.shadowRoot?.querySelector(selector)?.getAttribute('aria-label') ?? '';
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/transcript')) {
        const language = new URL(url).searchParams.get('language');
        return jsonResponse({ language, segments: language === 'am' ? amharic : english });
      }
      return jsonResponse(lessonBody());
    }),
  );
});

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('interface language', () => {
  it('uses English labels when lang is missing or unsupported', async () => {
    const player = await mount();
    expect(labelled(player, '.play-btn')).toBe('Play');
    expect(player.shadowRoot?.querySelector('.shortcut-help-btn')?.textContent?.trim()).toBe(
      'Keyboard shortcuts',
    );

    player.setAttribute('lang', 'fr');
    await player.updateComplete;
    expect(labelled(player, '.play-btn')).toBe('Play');
    expect(player.shadowRoot?.querySelector('#lesson-documents-heading')?.textContent).toBe(
      'Lesson documents',
    );
  });

  it('translates controls and keeps authored lesson content', async () => {
    const player = await mount('am-ET');
    await vi.waitFor(() =>
      expect(
        player.shadowRoot?.querySelector('savanna-transcript')?.shadowRoot?.textContent,
      ).toContain('Welcome to our networking lesson.'),
    );

    expect(labelled(player, '.play-btn')).toBe('አጫውት');
    expect(labelled(player, '.sign-language-btn')).toBe('የኢትዮጵያ የምልክት ቋንቋ');
    expect(player.shadowRoot?.querySelector('.caption-settings legend')?.textContent).toBe(
      'መግለጫ ጽሑፍ',
    );
    expect(player.shadowRoot?.querySelector('.shortcut-help-btn')?.textContent?.trim()).toBe(
      'የቁልፍ ሰሌዳ አቋራጮች',
    );
    expect(
      player.shadowRoot
        ?.querySelector('savanna-transcript')
        ?.shadowRoot?.querySelector('section')
        ?.getAttribute('aria-label'),
    ).toBe('ጽሑፋዊ ቅጂ');
    expect(player.shadowRoot?.querySelector('#lesson-documents-heading')?.textContent).toBe(
      'የትምህርት ሰነዶች',
    );
    expect(player.shadowRoot?.querySelector('.lesson-documents a')?.textContent).toBe(
      'Networking Notes፣ HTML',
    );
    expect(player.shadowRoot?.querySelector('#player-status')?.textContent).toContain(
      'Introduction to Networking',
    );
  });

  it('keeps interface language independent of caption and transcript language', async () => {
    const player = await mount('am');
    const transcript = player.shadowRoot?.querySelector('savanna-transcript');
    await vi.waitFor(() =>
      expect(transcript?.shadowRoot?.textContent).toContain('Welcome to our networking lesson.'),
    );
    expect(player.shadowRoot?.querySelector<HTMLSelectElement>('#caption-language')?.value).toBe(
      'en',
    );

    const amharicTranscript = [...(transcript?.shadowRoot?.querySelectorAll('button') ?? [])].find(
      (button) => button.textContent?.trim() === 'አማርኛ',
    );
    amharicTranscript?.click();
    await vi.waitFor(() =>
      expect(transcript?.shadowRoot?.textContent).toContain('እንኳን ወደ ኔትወርክ ትምህርታችን በደህና መጡ።'),
    );
    expect(labelled(player, '.play-btn')).toBe('አጫውት');

    player.setAttribute('caption-language', 'am');
    await player.updateComplete;
    expect(labelled(player, '.play-btn')).toBe('አጫውት');

    player.setAttribute('lang', 'en');
    await player.updateComplete;
    expect(labelled(player, '.play-btn')).toBe('Play');
    expect(transcript?.shadowRoot?.textContent).toContain('እንኳን ወደ ኔትወርክ ትምህርታችን በደህና መጡ።');
  });
});
