import type { Lesson } from '@savanna/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ETHIOPIC_FONT_LINK_ID } from '../src/config';
import {
  CAPTION_SETTINGS_KEY,
  DEFAULT_CAPTION_SETTINGS,
  loadCaptionSettings,
  saveCaptionSettings,
} from '../src/captions/caption-settings';
import { SavannaPlayer } from '../src/components/savanna-player';

function lessonWithCaptions(id = 'networking-101'): Lesson {
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
    captions: [
      { language: 'en', label: 'English', url: `https://media.example/${id}-en.vtt` },
      { language: 'am', label: 'አማርኛ', url: `https://media.example/${id}-am.vtt` },
    ],
    transcripts: [],
    documents: [],
    chapters: [],
  };
}

function isEthiopic(text: string): boolean {
  const characters = [...text].filter((character) => character.trim() !== '');
  return (
    characters.length > 0 &&
    characters.every((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 0x1200 && code <= 0x137f;
    })
  );
}

async function mountPlayer(attributes: Record<string, string> = {}): Promise<SavannaPlayer> {
  const player = document.createElement('savanna-player');
  for (const [name, value] of Object.entries(attributes)) player.setAttribute(name, value);
  document.body.append(player);
  await player.updateComplete;
  return player;
}

async function showLesson(player: SavannaPlayer, id = 'networking-101'): Promise<void> {
  player.lesson = lessonWithCaptions(id);
  await player.updateComplete;
}

function control<T extends HTMLElement>(player: SavannaPlayer, selector: string): T {
  const element = player.shadowRoot?.querySelector(selector);
  if (!(element instanceof HTMLElement)) throw new Error(`missing ${selector}`);
  return element as T;
}

function setValue(element: HTMLElement, value: string): void {
  if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLSelectElement)) {
    throw new Error('not a form control');
  }
  element.value = value;
  const eventName = element instanceof HTMLSelectElement ? 'change' : 'input';
  element.dispatchEvent(new Event(eventName, { bubbles: true }));
}

function setChecked(element: HTMLInputElement, checked: boolean): void {
  element.checked = checked;
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function captionTrack(player: SavannaPlayer, language: string): HTMLTrackElement {
  const element = player.videoElement?.querySelector(`track[srclang="${language}"]`);
  if (!(element instanceof HTMLTrackElement)) throw new Error(`missing ${language} caption track`);
  return element;
}

function cueCss(player: SavannaPlayer): string {
  return player.shadowRoot?.querySelector('style[data-savanna-cues]')?.textContent ?? '';
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
});

describe('caption settings (spec 4.2)', () => {
  it('enables English captions by default', () => {
    expect(DEFAULT_CAPTION_SETTINGS).toMatchObject({ enabled: true, language: 'en', fontScale: 1 });
  });

  it('defaults cannot be mutated by a consumer', () => {
    expect(Object.isFrozen(DEFAULT_CAPTION_SETTINGS)).toBe(true);
  });

  it('ignores stored settings that are not usable', () => {
    localStorage.setItem(CAPTION_SETTINGS_KEY, '{');
    expect(loadCaptionSettings()).toEqual({ ...DEFAULT_CAPTION_SETTINGS });

    localStorage.setItem(
      CAPTION_SETTINGS_KEY,
      JSON.stringify({ textColor: 'red; }', fontScale: 9, language: 'am' }),
    );
    expect(loadCaptionSettings()).toMatchObject({
      textColor: '#ffffff',
      fontScale: 2,
      language: 'am',
    });
    expect(Object.isFrozen(DEFAULT_CAPTION_SETTINGS)).toBe(true);
  });
});

describe('CaptionManager (spec 4.2)', () => {
  it('loads English and Amharic WebVTT tracks from lesson metadata', async () => {
    const player = await mountPlayer();
    await showLesson(player);

    const english = captionTrack(player, 'en');
    const amharic = captionTrack(player, 'am');
    expect(player.videoElement?.querySelectorAll('track')).toHaveLength(2);
    expect(english.kind).toBe('captions');
    expect(english.src).toBe('https://media.example/networking-101-en.vtt');
    expect(english.label).toBe('English');
    expect(amharic.kind).toBe('captions');
    expect(amharic.src).toBe('https://media.example/networking-101-am.vtt');
    expect(amharic.label).toBe('አማርኛ');
    expect(player.videoElement?.getAttribute('crossorigin')).toBe('anonymous');
    expect(player.shadowRoot?.querySelector('style[data-savanna-cues]')).not.toBeNull();
    expect(document.head.querySelector('style[data-savanna-cues]')).toBeNull();

    await showLesson(player, 'routing-201');
    expect(player.videoElement?.querySelectorAll('track')).toHaveLength(2);
    expect(captionTrack(player, 'en').src).toBe('https://media.example/routing-201-en.vtt');
  });

  it('switches caption language', async () => {
    const player = await mountPlayer();
    await showLesson(player);

    expect(captionTrack(player, 'en').track.mode).toBe('showing');
    expect(captionTrack(player, 'am').track.mode).toBe('disabled');

    setValue(control(player, '#caption-language'), 'am');
    await player.updateComplete;

    expect(control<HTMLSelectElement>(player, '#caption-language').value).toBe('am');
    expect(captionTrack(player, 'am').track.mode).toBe('showing');
    expect(captionTrack(player, 'en').track.mode).toBe('disabled');

    setChecked(control(player, '#caption-enabled'), false);
    await player.updateComplete;

    expect(captionTrack(player, 'en').track.mode).toBe('disabled');
    expect(captionTrack(player, 'am').track.mode).toBe('disabled');
  });

  it('applies font size, text color, background color and high-contrast settings', async () => {
    const player = await mountPlayer();
    await showLesson(player);

    setValue(control(player, '#caption-text'), '#ff00aa');
    setValue(control(player, '#caption-background'), '#112233');
    setValue(control(player, '#caption-size'), '1.5');
    await player.updateComplete;

    expect(player.videoElement?.style.fontSize).toBe('16px');
    expect(cueCss(player)).toContain('font-size: 150%');
    expect(cueCss(player)).toContain('color: #ff00aa');
    expect(cueCss(player)).toContain('background-color: #112233');
    expect(control<HTMLInputElement>(player, '#caption-size').getAttribute('aria-valuetext')).toBe(
      '150%',
    );

    setChecked(control(player, '#caption-contrast'), true);
    await player.updateComplete;

    expect(cueCss(player)).toContain('color: #000000');
    expect(cueCss(player)).toContain('background-color: #ffff00');
    expect(cueCss(player)).not.toContain('#ff00aa');
    expect(cueCss(player)).not.toContain('#112233');
    expect(control<HTMLInputElement>(player, '#caption-text').disabled).toBe(true);
    expect(control<HTMLInputElement>(player, '#caption-background').disabled).toBe(true);
  });

  it('persists caption settings across lessons', async () => {
    const first = await mountPlayer();
    await showLesson(first, 'networking-101');
    setValue(control(first, '#caption-language'), 'am');
    setValue(control(first, '#caption-size'), '1.5');
    setValue(control(first, '#caption-background'), '#00aa00');
    await first.updateComplete;
    first.remove();

    const second = await mountPlayer({ 'caption-language': 'en' });
    await showLesson(second, 'routing-201');

    expect(control<HTMLSelectElement>(second, '#caption-language').value).toBe('am');
    expect(control<HTMLInputElement>(second, '#caption-size').value).toBe('1.5');
    expect(control<HTMLInputElement>(second, '#caption-background').value).toBe('#00aa00');
    expect(captionTrack(second, 'am').track.mode).toBe('showing');
    expect(captionTrack(second, 'en').track.mode).toBe('disabled');
    expect(cueCss(second)).toContain('font-size: 150%');
    expect(cueCss(second)).toContain('background-color: #00aa00');
    expect(loadCaptionSettings().language).toBe('am');
  });

  it('uses the caption-language attribute until the learner saves a choice', async () => {
    const player = await mountPlayer({ 'caption-language': 'am' });
    await showLesson(player);

    expect(control<HTMLSelectElement>(player, '#caption-language').value).toBe('am');
    expect(captionTrack(player, 'am').track.mode).toBe('showing');
    expect(localStorage.getItem(CAPTION_SETTINGS_KEY)).toBeNull();

    saveCaptionSettings({ ...DEFAULT_CAPTION_SETTINGS, language: 'en', fontScale: 1.25 });
    const saved = await mountPlayer({ 'caption-language': 'am' });
    await showLesson(saved, 'routing-201');

    expect(control<HTMLSelectElement>(saved, '#caption-language').value).toBe('en');
    expect(cueCss(saved)).toContain('font-size: 125%');
  });

  it('renders Amharic (Ethiopic) text without fallback glyphs', async () => {
    const player = await mountPlayer();
    await showLesson(player);

    const label = captionTrack(player, 'am').label;
    expect(label).toBe('አማርኛ');
    expect(isEthiopic(label)).toBe(true);
    expect(label).not.toContain('\uFFFD');
    expect(control(player, 'option[value="am"]').textContent).toContain('አማርኛ');

    const css = cueCss(player);
    expect(css.indexOf('"Noto Sans Ethiopic"')).toBeGreaterThan(-1);
    expect(css.indexOf('"Noto Sans Ethiopic"')).toBeLessThan(css.indexOf('sans-serif'));
    expect(SavannaPlayer.styles.toString()).toContain('Noto Sans Ethiopic');

    const font = document.getElementById(ETHIOPIC_FONT_LINK_ID);
    expect(font).toBeInstanceOf(HTMLLinkElement);
    expect(font?.getAttribute('href')).toContain('family=Noto+Sans+Ethiopic');
  });
});
