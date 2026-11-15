import type { Lesson } from '@savanna/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import '../src/components/savanna-player';
import { MediaSync } from '../src/media/media-sync';
import type { SignLanguageWindow } from '../src/sign-language/sign-language-window';
import '../src/sign-language/sign-language-window';

function lessonWithSignLanguage(): Lesson {
  return {
    id: 'networking-101',
    title: 'Introduction to Networking',
    description: 'Learn the fundamentals of computer networking.',
    language: 'en',
    media: {
      video: 'https://media.example/video.mp4',
      audio: null,
      signLanguage: 'https://media.example/networking-101-ethsl.mp4',
      audioDescription: null,
      poster: null,
    },
    captions: [],
    transcripts: [],
    documents: [],
    chapters: [],
  };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('sign-language window (spec 4.3)', () => {
  it('can be shown and hidden with an accessible toggle', async () => {
    const player = document.createElement('savanna-player');
    document.body.append(player);
    await player.updateComplete;
    player.lesson = lessonWithSignLanguage();
    await player.updateComplete;

    // Accessible toggle button in toolbar
    const toggle = player.shadowRoot?.querySelector<HTMLButtonElement>('.sign-language-btn');
    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute('aria-label')).toBe('Ethiopian Sign Language');
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');

    const signWindow =
      player.shadowRoot?.querySelector<SignLanguageWindow>('savanna-sign-language');
    expect(signWindow).not.toBeNull();
    expect(signWindow?.open).toBe(false);

    // Toggle open
    toggle?.click();
    await player.updateComplete;
    await signWindow?.updateComplete;

    expect(toggle?.getAttribute('aria-pressed')).toBe('true');
    expect(signWindow?.open).toBe(true);

    const section = signWindow?.shadowRoot?.querySelector('section');
    expect(section?.hidden).toBe(false);
    expect(section?.getAttribute('aria-label')).toBe('Ethiopian Sign Language interpreter');

    // Video has sign-language source
    const video = signWindow?.videoElement;
    expect(video?.getAttribute('src')).toBe('https://media.example/networking-101-ethsl.mp4');

    // Dismiss with close button without keyboard trap
    const closeBtn = signWindow?.shadowRoot?.querySelector<HTMLButtonElement>('.close-btn');
    expect(closeBtn).not.toBeNull();
    expect(closeBtn?.getAttribute('aria-label')).toBe('Close sign language window');

    closeBtn?.click();
    await player.updateComplete;
    await signWindow?.updateComplete;

    expect(signWindow?.open).toBe(false);
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
  });

  it('can be moved and resized with pointer and keyboard', async () => {
    const signWindow = document.createElement('savanna-sign-language');
    signWindow.open = true;
    document.body.append(signWindow);
    await signWindow.updateComplete;

    // Programmatic / pointer move
    signWindow.moveTo(50, 60);
    await signWindow.updateComplete;
    expect(signWindow.x).toBe(50);
    expect(signWindow.y).toBe(60);

    // Keyboard move via drag handle
    const dragHandle = signWindow.shadowRoot?.querySelector<HTMLElement>('.drag-handle');
    expect(dragHandle).not.toBeNull();

    dragHandle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await signWindow.updateComplete;
    expect(signWindow.x).toBeGreaterThan(50);

    dragHandle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await signWindow.updateComplete;
    expect(signWindow.y).toBeGreaterThan(60);

    // Pointer resize
    signWindow.resizeTo(250, 180);
    await signWindow.updateComplete;
    expect(signWindow.width).toBe(250);
    expect(signWindow.height).toBe(180);

    // Keyboard resize via Shift+Arrow keys on drag handle
    dragHandle?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }),
    );
    await signWindow.updateComplete;
    expect(signWindow.width).toBeGreaterThan(250);

    // Keyboard resize via resize-handle control
    const resizeHandle = signWindow.shadowRoot?.querySelector<HTMLButtonElement>('.resize-handle');
    expect(resizeHandle).not.toBeNull();
    const prevHeight = signWindow.height;
    resizeHandle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await signWindow.updateComplete;
    expect(signWindow.height).toBeGreaterThan(prevHeight);

    // Dismiss without a keyboard trap via Escape
    dragHandle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await signWindow.updateComplete;
    expect(signWindow.open).toBe(false);
  });

  it('stays within the player on small screens', async () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 320, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 240, configurable: true });

    const signWindow = document.createElement('savanna-sign-language');
    signWindow.open = true;
    container.append(signWindow);
    document.body.append(container);
    await signWindow.updateComplete;

    // Moving far outside bounds clamps within container (320x240)
    signWindow.moveTo(500, 500);
    await signWindow.updateComplete;

    expect(signWindow.x + signWindow.width).toBeLessThanOrEqual(320);
    expect(signWindow.y + signWindow.height).toBeLessThanOrEqual(240);
    expect(signWindow.x).toBeGreaterThanOrEqual(0);
    expect(signWindow.y).toBeGreaterThanOrEqual(0);

    // Resizing beyond container dimensions clamps to container size
    signWindow.resizeTo(400, 300);
    await signWindow.updateComplete;

    expect(signWindow.width).toBeLessThanOrEqual(320);
    expect(signWindow.height).toBeLessThanOrEqual(240);
  });
});

describe('secondary media sync (spec 4.3, 4.4)', () => {
  it('follows the main video on play and pause', () => {
    const primary = document.createElement('video');
    const secondary = document.createElement('video');
    const sync = new MediaSync(primary);

    const playSpy = vi.spyOn(secondary, 'play').mockResolvedValue(undefined);
    const pauseSpy = vi.spyOn(secondary, 'pause').mockImplementation(() => {});

    sync.attach(secondary);

    // Primary plays -> secondary plays
    Object.defineProperty(primary, 'paused', { value: false, configurable: true });
    primary.dispatchEvent(new Event('play'));
    expect(playSpy).toHaveBeenCalled();

    // Primary pauses -> secondary pauses
    Object.defineProperty(primary, 'paused', { value: true, configurable: true });
    primary.dispatchEvent(new Event('pause'));
    expect(pauseSpy).toHaveBeenCalled();

    sync.dispose();
  });

  it('follows the main video on seek', () => {
    const primary = document.createElement('video');
    const secondary = document.createElement('video');
    const sync = new MediaSync(primary);

    sync.attach(secondary);

    primary.currentTime = 42;
    primary.dispatchEvent(new Event('seeked'));

    expect(secondary.currentTime).toBe(42);

    sync.dispose();
  });

  it('follows playback-rate changes', () => {
    const primary = document.createElement('video');
    const secondary = document.createElement('video');
    const sync = new MediaSync(primary);

    sync.attach(secondary);

    primary.playbackRate = 1.5;
    primary.dispatchEvent(new Event('ratechange'));

    expect(secondary.playbackRate).toBe(1.5);

    sync.dispose();
  });

  it('re-syncs when drift exceeds the tolerance', () => {
    const primary = document.createElement('video');
    const secondary = document.createElement('video');
    const tolerance = 0.3;
    const sync = new MediaSync(primary, tolerance);

    sync.attach(secondary);

    primary.currentTime = 10;
    secondary.currentTime = 9.9; // drift 0.1 <= 0.3 tolerance

    primary.dispatchEvent(new Event('timeupdate'));
    // Within tolerance: secondary is not re-seeked
    expect(secondary.currentTime).toBe(9.9);

    secondary.currentTime = 9.5; // drift 0.5 > 0.3 tolerance
    primary.dispatchEvent(new Event('timeupdate'));
    // Exceeds tolerance: secondary is re-synced to primary time
    expect(secondary.currentTime).toBe(10);

    sync.dispose();
  });

  it('audio description can be enabled and disabled', async () => {
    const descriptionUrl = 'https://media.example/networking-101-description.mp3';
    const player = document.createElement('savanna-player');
    document.body.append(player);
    await player.updateComplete;

    player.lesson = lessonWithSignLanguage();
    await player.updateComplete;
    expect(player.shadowRoot?.querySelector('.audio-description-btn')).toBeNull();

    player.lesson = lessonWithAudioDescription(descriptionUrl);
    await player.updateComplete;

    const toggle = player.shadowRoot?.querySelector<HTMLButtonElement>('.audio-description-btn');
    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute('aria-label')).toBe('Audio description');
    expect(toggle?.querySelector('.visually-hidden')?.textContent).toBe('Audio description');
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
    expect(player.audioDescriptionElement).toBeNull();

    toggle?.click();
    await player.updateComplete;

    expect(toggle?.getAttribute('aria-pressed')).toBe('true');
    const description = player.audioDescriptionElement;
    expect(description).toBeInstanceOf(HTMLAudioElement);
    expect(description?.getAttribute('src')).toBe(descriptionUrl);

    const video = player.videoElement;
    expect(video).not.toBeNull();
    const playSpy = vi.spyOn(description!, 'play').mockResolvedValue(undefined);
    Object.defineProperty(video!, 'paused', { value: false, configurable: true });
    video?.dispatchEvent(new Event('play'));
    expect(playSpy).toHaveBeenCalled();

    video!.currentTime = 12;
    video?.dispatchEvent(new Event('seeked'));
    expect(description?.currentTime).toBe(12);

    video!.playbackRate = 1.25;
    video?.dispatchEvent(new Event('ratechange'));
    expect(description?.playbackRate).toBe(1.25);

    const pauseSpy = vi.spyOn(description!, 'pause').mockImplementation(() => {});
    toggle?.click();
    await player.updateComplete;

    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
    expect(pauseSpy).toHaveBeenCalled();
    expect(player.audioDescriptionElement).toBeNull();

    playSpy.mockClear();
    video?.dispatchEvent(new Event('play'));
    expect(playSpy).not.toHaveBeenCalled();
  });
});

function lessonWithAudioDescription(url: string): Lesson {
  return {
    id: 'networking-101',
    title: 'Introduction to Networking',
    description: 'Learn the fundamentals of computer networking.',
    language: 'en',
    media: {
      video: 'https://media.example/video.mp4',
      audio: null,
      signLanguage: null,
      audioDescription: url,
      poster: null,
    },
    captions: [],
    transcripts: [],
    documents: [],
    chapters: [],
  };
}
