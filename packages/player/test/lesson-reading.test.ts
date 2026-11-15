import type { Lesson } from '@savanna/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../src/index';
import type { SavannaPlayer } from '../src/components/savanna-player';
import { MediaController } from '../src/media/media-controller';
import { LESSON_BOOKMARKS_KEY, LESSON_POSITIONS_KEY, PLAYBACK_SETTINGS_KEY } from '../src/config';
import { readLessonPosition } from '../src/playback/playback-memory';

const english = [
  { start: 0, end: 4, text: 'Welcome to our networking lesson.' },
  { start: 45, end: 50, text: 'Computers connect through a network.' },
];
const amharic = [{ start: 0, end: 4, text: 'እንኳን ወደ ኔትወርክ ትምህርታችን በደህና መጡ።' }];

const documents = [
  {
    title: 'Networking Notes',
    language: 'en',
    html: 'https://media.example/notes.html',
    pdf: 'https://media.example/notes.pdf',
  },
];

function lessonBody(id: string, chapters?: Lesson['chapters']): Lesson {
  return {
    id,
    title: 'Introduction to Networking',
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
    documents: id === 'networking-101' ? documents : [],
    chapters: chapters ?? [],
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function installApi(chapters?: Lesson['chapters'] | 'omit'): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const id = url.includes('routing-201') ? 'routing-201' : 'networking-101';
      if (url.includes('/transcript')) {
        const language = new URL(url).searchParams.get('language');
        return jsonResponse({
          language,
          segments: language === 'am' ? amharic : id === 'networking-101' ? english : [],
        });
      }
      const lesson = lessonBody(id, chapters === 'omit' ? [] : chapters);
      if (chapters === 'omit') {
        const withoutChapters = { ...lesson, chapters: undefined };
        return jsonResponse(withoutChapters);
      }
      return jsonResponse(id === 'networking-101' ? lesson : lessonBody(id, []));
    }),
  );
}

async function mount(id = 'networking-101'): Promise<SavannaPlayer> {
  const player = document.createElement('savanna-player');
  player.setAttribute('lesson-id', id);
  player.setAttribute('api-base', 'https://api.example');
  document.body.append(player);
  await vi.waitFor(() => expect(player.status).toBe('ready'));
  player.videoElement?.dispatchEvent(new Event('loadedmetadata'));
  await player.updateComplete;
  return player;
}

function playbackProgress(player: SavannaPlayer): { lessonId: string; currentTime: number }[] {
  const progress: { lessonId: string; currentTime: number }[] = [];
  player.addEventListener('savanna-progress', ((
    event: CustomEvent<{ lessonId: string; currentTime: number }>,
  ) => {
    progress.push(event.detail);
  }) as EventListener);
  return progress;
}

function transcriptPanel(player: SavannaPlayer): HTMLElement {
  const panel = player.shadowRoot?.querySelector('savanna-transcript');
  if (!(panel instanceof HTMLElement)) throw new Error('transcript is missing');
  return panel;
}

async function bookmarkButton(player: SavannaPlayer, text: string): Promise<HTMLButtonElement> {
  const panel = transcriptPanel(player);
  let button: HTMLButtonElement | undefined;
  await vi.waitFor(() => {
    button = [
      ...(panel.shadowRoot?.querySelectorAll<HTMLButtonElement>('button.bookmark-sentence') ?? []),
    ].find((candidate) => candidate.getAttribute('aria-label')?.includes(text));
    expect(button).toBeInstanceOf(HTMLButtonElement);
  });
  if (button === undefined) throw new Error(`bookmark for ${text} is missing`);
  return button;
}

function languageButton(player: SavannaPlayer, label: string): HTMLButtonElement {
  const button = [...(transcriptPanel(player).shadowRoot?.querySelectorAll('button') ?? [])].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!(button instanceof HTMLButtonElement)) throw new Error(`${label} is missing`);
  return button;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('chapters, bookmarks, transcript export, and the text lesson', () => {
  it('renders chapter names and start times from lesson metadata', async () => {
    installApi([
      { name: 'How computers connect', start: 45 },
      { name: '   ', start: 10 },
      { name: 'Welcome', start: -1 },
      { name: 'Addresses on a network', start: 90 },
    ]);
    const player = await mount();
    const buttons = [
      ...(player.shadowRoot?.querySelectorAll<HTMLButtonElement>('button.chapter-btn') ?? []),
    ];

    expect(player.shadowRoot?.querySelector('#chapters-heading')?.textContent).toBe('Chapters');
    expect(buttons.map((button) => button.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'How computers connect starts at 0:45',
      'Addresses on a network starts at 1:30',
    ]);
    for (const button of buttons) {
      expect(button).toBeInstanceOf(HTMLButtonElement);
      expect(button.getAttribute('type')).toBe('button');
    }
    buttons[0]?.focus();
    expect(player.shadowRoot?.activeElement).toBe(buttons[0]);
  });

  it('seeks to a chapter through the shared progress path', async () => {
    installApi([
      { name: 'Welcome', start: 0 },
      { name: 'How computers connect', start: 45 },
    ]);
    const player = await mount();
    const progress = playbackProgress(player);
    const seekTo = vi.spyOn(MediaController.prototype, 'seekTo');

    const chapter = [...(player.shadowRoot?.querySelectorAll('button.chapter-btn') ?? [])].find(
      (button) => button.textContent?.includes('How computers connect'),
    );
    chapter?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await player.updateComplete;

    expect(seekTo).toHaveBeenCalledWith(45);
    expect(player.videoElement?.currentTime).toBe(45);
    expect(player.currentTime).toBe(45);
    expect(readLessonPosition('networking-101')).toBe(45);
    expect(progress.at(-1)).toEqual({ lessonId: 'networking-101', currentTime: 45 });
  });

  it('omits chapter controls when a lesson has no chapters', async () => {
    installApi('omit');
    const missing = await mount();
    expect(missing.shadowRoot?.querySelector('.chapters')).toBeNull();
    missing.remove();

    installApi([]);
    const empty = await mount();
    expect(empty.shadowRoot?.querySelector('.chapters')).toBeNull();
  });

  it('saves a sentence bookmark, restores it on the next visit, and removes it', async () => {
    installApi();
    const player = await mount();
    const button = await bookmarkButton(player, 'Welcome to our networking lesson.');
    expect(button.getAttribute('type')).toBe('button');
    button.click();
    await player.updateComplete;

    expect(player.shadowRoot?.querySelector('.bookmark-btn')?.textContent).toContain(
      'Welcome to our networking lesson.',
    );
    expect(player.shadowRoot?.querySelector('.bookmark-status')?.textContent).toBe(
      'Bookmark saved.',
    );
    expect(localStorage.getItem(LESSON_BOOKMARKS_KEY)).toContain(
      'Welcome to our networking lesson.',
    );
    expect(localStorage.getItem(LESSON_POSITIONS_KEY) ?? '').not.toContain('Welcome');
    expect(localStorage.getItem(PLAYBACK_SETTINGS_KEY) ?? '').not.toContain('Welcome');
    player.remove();

    const reloaded = await mount();
    expect(reloaded.shadowRoot?.querySelector('.bookmark-btn')?.textContent).toContain(
      'Welcome to our networking lesson.',
    );

    reloaded.shadowRoot
      ?.querySelector('button.bookmark-remove')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await reloaded.updateComplete;
    expect(reloaded.shadowRoot?.querySelector('.bookmark-btn')).toBeNull();
    expect(reloaded.shadowRoot?.querySelector('.bookmark-empty')?.textContent).toBe(
      'No bookmarks yet.',
    );
    expect(reloaded.shadowRoot?.querySelector('.bookmark-status')?.textContent).toBe(
      'Bookmark removed.',
    );
    reloaded.remove();

    const afterRemoval = await mount();
    expect(afterRemoval.shadowRoot?.querySelector('.bookmark-btn')).toBeNull();
  });

  it('keeps bookmarks separated by lesson and language and rejects duplicates', async () => {
    installApi();
    const player = await mount();
    (await bookmarkButton(player, 'Welcome to our networking lesson.')).click();
    (await bookmarkButton(player, 'Welcome to our networking lesson.')).click();
    await player.updateComplete;

    expect(player.shadowRoot?.querySelectorAll('.bookmark-btn')).toHaveLength(1);
    expect(player.shadowRoot?.querySelector('.bookmark-status')?.textContent).toBe(
      'This sentence is already bookmarked.',
    );

    languageButton(player, 'አማርኛ').click();
    await player.updateComplete;
    expect(player.shadowRoot?.querySelector('.bookmark-btn')).toBeNull();
    (await bookmarkButton(player, 'እንኳን')).click();
    await player.updateComplete;
    expect(player.shadowRoot?.querySelector('.bookmark-btn')?.textContent).toContain('እንኳን');
    expect(player.shadowRoot?.querySelector('.bookmark-btn')?.textContent).not.toContain('Welcome');
    player.remove();

    const otherLesson = await mount('routing-201');
    expect(otherLesson.shadowRoot?.querySelector('.bookmark-btn')).toBeNull();
    otherLesson.remove();

    const englishAgain = await mount();
    expect(englishAgain.shadowRoot?.querySelector('.bookmark-btn')?.textContent).toContain(
      'Welcome to our networking lesson.',
    );
    expect(englishAgain.shadowRoot?.querySelector('.bookmark-btn')?.textContent).not.toContain(
      'እንኳን',
    );
  });

  it('seeks to a bookmark through the shared progress path', async () => {
    installApi();
    const player = await mount();
    (await bookmarkButton(player, 'Computers connect through a network.')).click();
    await player.updateComplete;
    const progress = playbackProgress(player);
    const seekTo = vi.spyOn(MediaController.prototype, 'seekTo');

    player.shadowRoot
      ?.querySelector('button.bookmark-btn')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await player.updateComplete;

    expect(seekTo).toHaveBeenCalledWith(45);
    expect(player.videoElement?.currentTime).toBe(45);
    expect(readLessonPosition('networking-101')).toBe(45);
    expect(progress.at(-1)).toEqual({ lessonId: 'networking-101', currentTime: 45 });
  });

  it('downloads the transcript for the selected language and explains an empty transcript', async () => {
    installApi();
    const player = await mount();
    await bookmarkButton(player, 'Welcome to our networking lesson.');
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:transcript');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });

    player.shadowRoot
      ?.querySelector('button.download-transcript-btn')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await player.updateComplete;

    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(await (blob as Blob).text()).toBe(
      '0:00 Welcome to our networking lesson.\n0:45 Computers connect through a network.\n',
    );
    expect(downloads).toEqual(['networking-101-en.txt']);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:transcript');
    expect(player.shadowRoot?.querySelector('.reading-status')?.textContent).toBe(
      'Transcript downloaded.',
    );

    languageButton(player, 'አማርኛ').click();
    await bookmarkButton(player, 'እንኳን');
    player.shadowRoot
      ?.querySelector('button.download-transcript-btn')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await player.updateComplete;
    const amharicBlob = createObjectURL.mock.calls.at(-1)?.[0];
    expect(await (amharicBlob as Blob).text()).toBe('0:00 እንኳን ወደ ኔትወርክ ትምህርታችን በደህና መጡ።\n');
    expect(downloads.at(-1)).toBe('networking-101-am.txt');
    player.remove();

    const emptyPlayer = await mount('routing-201');
    await vi.waitFor(() => expect(emptyPlayer.transcriptSegments).toEqual([]));
    createObjectURL.mockClear();
    emptyPlayer.shadowRoot
      ?.querySelector('button.download-transcript-btn')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await emptyPlayer.updateComplete;
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(emptyPlayer.shadowRoot?.querySelector('.reading-status')?.textContent).toBe(
      'There is no transcript to download.',
    );
  });

  it('opens and closes a text lesson with the transcript and document links', async () => {
    installApi([{ name: 'Welcome', start: 0 }]);
    const player = await mount();
    await bookmarkButton(player, 'Welcome to our networking lesson.');
    const toggle = player.shadowRoot?.querySelector('button.text-lesson-btn');

    expect(toggle).toBeInstanceOf(HTMLButtonElement);
    expect(toggle?.textContent?.trim()).toBe('Text lesson');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(toggle?.getAttribute('aria-controls')).toBe('text-lesson');
    expect(player.shadowRoot?.querySelector('#text-lesson')).toBeNull();
    toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await player.updateComplete;

    const reading = player.shadowRoot?.querySelector('#text-lesson');
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(reading?.querySelector('h2')?.textContent).toBe('Text lesson');
    expect(reading?.querySelector('.text-lesson-transcript')?.getAttribute('lang')).toBe('en');
    expect(reading?.querySelector('.text-lesson-sentence')?.textContent).toContain(
      'Welcome to our networking lesson.',
    );
    const links = [...(reading?.querySelectorAll('a') ?? [])];
    expect(links.map((link) => link.textContent)).toEqual([
      'Networking Notes, HTML',
      'Networking Notes, PDF',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://media.example/notes.html',
      'https://media.example/notes.pdf',
    ]);
    expect(reading?.querySelector('#text-lesson-documents-heading')?.textContent).toBe(
      'Lesson documents',
    );
    (toggle as HTMLButtonElement).focus();
    expect(player.shadowRoot?.activeElement).toBe(toggle);

    const progress = playbackProgress(player);
    const seekTo = vi.spyOn(MediaController.prototype, 'seekTo');
    reading
      ?.querySelector('button.text-lesson-sentence')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(seekTo).toHaveBeenCalledWith(0);
    expect(progress.at(-1)).toEqual({ lessonId: 'networking-101', currentTime: 0 });

    toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await player.updateComplete;
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(player.shadowRoot?.querySelector('#text-lesson')).toBeNull();
    expect(player.shadowRoot?.querySelector('#lesson-documents-heading')).not.toBeNull();
  });

  it('updates the open text lesson when the transcript language changes', async () => {
    installApi();
    const player = await mount();
    await bookmarkButton(player, 'Welcome to our networking lesson.');
    player.shadowRoot
      ?.querySelector('button.text-lesson-btn')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await player.updateComplete;

    languageButton(player, 'አማርኛ').click();
    await vi.waitFor(() => {
      expect(
        player.shadowRoot?.querySelector('#text-lesson .text-lesson-transcript')?.textContent,
      ).toContain('እንኳን');
    });
    const reading = player.shadowRoot?.querySelector('#text-lesson');
    expect(reading?.querySelector('.text-lesson-transcript')?.getAttribute('lang')).toBe('am');
    expect(reading?.textContent).not.toContain('Welcome to our networking lesson.');
    expect(reading?.querySelector('a')?.textContent).toBe('Networking Notes, HTML');
  });
});
