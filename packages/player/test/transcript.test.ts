import type { TranscriptSegment } from '@savanna/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import '../src/components/savanna-player';
import type { SavannaPlayer } from '../src/components/savanna-player';
import { MediaController } from '../src/media/media-controller';
import { TRANSCRIPT_SCROLL_IDLE_MS } from '../src/transcript/transcript-panel';
import type { TranscriptPanel } from '../src/transcript/transcript-panel';
import { findActiveSegment, searchSegments } from '../src/transcript/transcript-sync';

const segments: TranscriptSegment[] = [
  { start: 0, end: 4, text: 'Welcome to our networking lesson.' },
  { start: 5, end: 8, text: 'እንኳን ወደ ኔትወርክ ትምህርታችን በደህና መጡ።' },
];

const searchable: TranscriptSegment[] = [
  { start: 0, end: 4, text: 'Alpha welcome' },
  { start: 5, end: 8, text: 'Beta welcome' },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function lessonResponse() {
  return jsonResponse({
    id: 'networking-101',
    title: 'Introduction to Computer Networking',
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
    transcripts: [
      { language: 'en', label: 'English', url: 'https://api.example/en' },
      { language: 'am', label: 'Amharic', url: 'https://api.example/am' },
    ],
    documents: [],
  });
}

async function mountPanel(props: {
  segments: TranscriptSegment[];
  currentTime?: number;
  language?: string;
}): Promise<TranscriptPanel> {
  const panel = document.createElement('savanna-transcript') as TranscriptPanel;
  panel.segments = props.segments;
  panel.currentTime = props.currentTime ?? 0;
  panel.language = props.language ?? 'en';
  document.body.append(panel);
  await panel.updateComplete;
  return panel;
}

function segmentButton(panel: TranscriptPanel, index: number): HTMLButtonElement {
  const button = panel.shadowRoot?.querySelector<HTMLButtonElement>(`[data-index="${index}"]`);
  if (button === null || button === undefined) throw new Error(`segment ${index} is missing`);
  return button;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('synchronized transcript (spec 4.5)', () => {
  it('findActiveSegment returns the segment containing the current time', () => {
    expect(findActiveSegment(segments, 1)).toBe(0);
    expect(findActiveSegment(segments, 4)).toBe(0);
    expect(
      findActiveSegment(
        [
          { start: 0, end: 4, text: 'First' },
          { start: 4, end: 8, text: 'Second' },
        ],
        4,
      ),
    ).toBe(1);
  });

  it('findActiveSegment returns -1 between segments and after the last one', () => {
    expect(findActiveSegment(segments, 4.5)).toBe(-1);
    expect(findActiveSegment(segments, 8.1)).toBe(-1);
    expect(findActiveSegment([], 0)).toBe(-1);
  });

  it('highlights the active segment and auto-scrolls to it', async () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const panel = await mountPanel({ segments, currentTime: -1 });

    panel.currentTime = 1;
    await panel.updateComplete;

    expect(segmentButton(panel, 0).getAttribute('aria-current')).toBe('true');
    expect(segmentButton(panel, 0).getAttribute('lang')).toBe('en');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    scrollIntoView.mockClear();
    panel.currentTime = 2;
    await panel.updateComplete;
    expect(scrollIntoView).not.toHaveBeenCalled();

    panel.currentTime = 6;
    await panel.updateComplete;
    expect(segmentButton(panel, 1).getAttribute('aria-current')).toBe('true');
    expect(segmentButton(panel, 1).getAttribute('lang')).toBe('en');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('clicking a native segment button seeks the video', async () => {
    const panel = await mountPanel({ segments, currentTime: 0 });
    const video = document.createElement('video');
    const controller = new MediaController(video);
    panel.addEventListener('savanna-transcript-seek', ((
      event: CustomEvent<{ seconds: number }>,
    ) => {
      controller.seekTo(event.detail.seconds);
    }) as EventListener);

    const first = segmentButton(panel, 0);
    const second = segmentButton(panel, 1);
    expect(first.tagName).toBe('BUTTON');
    expect(second.tagName).toBe('BUTTON');

    second.click();
    expect(video.currentTime).toBe(5);
  });

  it('search matches English and Amharic text', async () => {
    expect(searchSegments(segments, 'WELCOME')).toEqual([0]);
    expect(searchSegments(segments, 'እንኳን')).toEqual([1]);
    expect(searchSegments(segments, '   ')).toEqual([]);

    const panel = await mountPanel({ segments, currentTime: 6, language: 'am' });
    const input = panel.shadowRoot?.querySelector('input');
    if (input === null || input === undefined) throw new Error('search field is missing');
    input.value = 'እንኳን';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await panel.updateComplete;

    expect(panel.shadowRoot?.querySelectorAll('[data-index]')).toHaveLength(1);
    const match = segmentButton(panel, 1);
    expect(match.textContent?.trim()).toBe('እንኳን ወደ ኔትወርክ ትምህርታችን በደህና መጡ።');
    expect(match.getAttribute('lang')).toBe('am');
    expect(match.tagName).toBe('BUTTON');
  });

  it('pauses auto-scroll while the learner is scrolling or searching', async () => {
    vi.useFakeTimers();
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const panel = await mountPanel({ segments: searchable, currentTime: 1 });
    scrollIntoView.mockClear();

    const input = panel.shadowRoot?.querySelector('input');
    if (input === null || input === undefined) throw new Error('search field is missing');
    input.value = 'welcome';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await panel.updateComplete;
    panel.currentTime = 6;
    await panel.updateComplete;
    expect(scrollIntoView).not.toHaveBeenCalled();

    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await panel.updateComplete;
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    scrollIntoView.mockClear();
    panel.shadowRoot?.querySelector('.segments')?.dispatchEvent(new Event('scroll'));
    panel.currentTime = 1;
    await panel.updateComplete;
    expect(scrollIntoView).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(TRANSCRIPT_SCROLL_IDLE_MS);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    scrollIntoView.mockClear();
    panel.shadowRoot?.querySelector('.segments')?.dispatchEvent(new Event('scroll'));
    panel.remove();
    await vi.advanceTimersByTimeAsync(TRANSCRIPT_SCROLL_IDLE_MS);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('ignores a stale transcript and keeps the lesson ready when loading fails', async () => {
    const errors: string[] = [];
    const pending = new Map<string, (response: Response) => void>();
    vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes('/transcript')) return Promise.resolve(lessonResponse());
      return new Promise<Response>((resolve) => {
        pending.set(url, resolve);
      });
    });

    const player = document.createElement('savanna-player') as SavannaPlayer;
    player.addEventListener('savanna-error', ((event: CustomEvent<{ message: string }>) => {
      errors.push(event.detail.message);
    }) as EventListener);
    player.setAttribute('lesson-id', 'networking-101');
    player.setAttribute('api-base', 'https://api.example');
    document.body.append(player);
    await vi.waitFor(() => expect(player.status).toBe('ready'));
    await player.updateComplete;

    const panel = player.shadowRoot?.querySelector('savanna-transcript');
    if (panel === null || panel === undefined) throw new Error('transcript panel is missing');
    panel.dispatchEvent(
      new CustomEvent('savanna-transcript-language', {
        detail: { language: 'am' },
        bubbles: true,
        composed: true,
      }),
    );
    await player.updateComplete;

    const english = [...pending.keys()].find((url) => url.includes('language=en'));
    const amharic = [...pending.keys()].find((url) => url.includes('language=am'));
    if (english === undefined || amharic === undefined) {
      throw new Error('transcript requests were not started');
    }
    pending.get(english)?.(
      jsonResponse({ language: 'en', segments: [{ start: 0, end: 1, text: 'English line' }] }),
    );
    await player.updateComplete;
    expect(panel.shadowRoot?.textContent).not.toContain('English line');

    pending.get(amharic)?.(
      jsonResponse({
        language: 'am',
        segments: [{ start: 0, end: 2, text: 'እንኳን ደህና መጡ' }],
      }),
    );
    await vi.waitFor(() => expect(panel.shadowRoot?.textContent).toContain('እንኳን ደህና መጡ'));
    expect(panel.shadowRoot?.querySelector('[data-index="0"]')?.getAttribute('lang')).toBe('am');
    expect(player.status).toBe('ready');
    expect(errors).toEqual([]);

    pending.clear();
    player.setAttribute('caption-language', 'am');
    await player.updateComplete;
    pending.clear();
    player.setAttribute('caption-language', 'en');
    await player.updateComplete;
    const nextEnglish = [...pending.keys()].find((url) => url.includes('language=en'));
    if (nextEnglish === undefined) throw new Error('english transcript was not requested');
    pending.get(nextEnglish)?.(jsonResponse({ detail: 'Transcript was not found' }, 404));
    await vi.waitFor(() => {
      expect(panel.shadowRoot?.textContent).not.toContain('እንኳን ደህና መጡ');
    });
    expect(player.status).toBe('ready');
    expect(errors).toEqual([]);
  });

  it('starts a new lesson in the configured caption language', async () => {
    const transcriptUrls: string[] = [];
    vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes('/transcript')) return Promise.resolve(lessonResponse());
      transcriptUrls.push(url);
      const language = url.includes('language=am') ? 'am' : 'en';
      return Promise.resolve(
        jsonResponse({
          language,
          segments: [
            { start: 0, end: 1, text: language === 'am' ? 'Amharic line' : 'English line' },
          ],
        }),
      );
    });

    const player = document.createElement('savanna-player') as SavannaPlayer;
    player.setAttribute('caption-language', 'en');
    player.setAttribute('lesson-id', 'networking-101');
    player.setAttribute('api-base', 'https://api.example');
    document.body.append(player);
    await vi.waitFor(() => expect(player.status).toBe('ready'));
    await player.updateComplete;

    const panel = player.shadowRoot?.querySelector('savanna-transcript');
    if (panel === null || panel === undefined) throw new Error('transcript panel is missing');
    panel.dispatchEvent(
      new CustomEvent('savanna-transcript-language', {
        detail: { language: 'am' },
        bubbles: true,
        composed: true,
      }),
    );
    await vi.waitFor(() =>
      expect(transcriptUrls.some((url) => url.includes('language=am'))).toBe(true),
    );

    transcriptUrls.length = 0;
    player.setAttribute('lesson-id', 'networking-102');
    await vi.waitFor(() => expect(player.status).toBe('ready'));
    await player.updateComplete;
    await vi.waitFor(() => expect(transcriptUrls).toHaveLength(1));

    expect(player.transcriptLanguage).toBe('en');
    expect(transcriptUrls[0]).toContain('/lessons/networking-102/transcript');
    expect(transcriptUrls[0]).toContain('language=en');
  });

  it('requests the final transcript language once when status and language change together', async () => {
    const transcriptUrls: string[] = [];
    let releaseLesson: (response: Response) => void = () => {};
    const lessonPending = new Promise<Response>((resolve) => {
      releaseLesson = resolve;
    });
    vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes('/transcript')) return lessonPending;
      transcriptUrls.push(url);
      return Promise.resolve(
        jsonResponse({ language: 'am', segments: [{ start: 0, end: 1, text: 'Amharic line' }] }),
      );
    });

    const player = document.createElement('savanna-player') as SavannaPlayer;
    player.setAttribute('lesson-id', 'networking-101');
    player.setAttribute('api-base', 'https://api.example');
    document.body.append(player);
    await vi.waitFor(() => expect(player.status).toBe('loading'));
    await player.updateComplete;

    player.captionLanguage = 'am';
    player.status = 'ready';
    await player.updateComplete;
    await vi.waitFor(() => expect(transcriptUrls).toHaveLength(1));

    expect(player.transcriptLanguage).toBe('am');
    expect(transcriptUrls[0]).toContain('language=am');

    releaseLesson(lessonResponse());
    await vi.waitFor(() => expect(player.lesson?.id).toBe('networking-101'));
    await player.updateComplete;
    expect(transcriptUrls).toHaveLength(1);
  });
});
