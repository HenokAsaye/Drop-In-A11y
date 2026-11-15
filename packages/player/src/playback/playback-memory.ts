import { LESSON_POSITIONS_KEY, PLAYBACK_SETTINGS_KEY } from '../config';

export { LESSON_POSITIONS_KEY, PLAYBACK_SETTINGS_KEY };

export interface PlaybackStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface PlaybackSettings {
  volume: number;
  playbackRate: number;
  muted: boolean;
}

const MAX_RATE = 4;
const LESSON_ID_LIMIT = 200;

export function readPlaybackSettings(storage?: PlaybackStore): PlaybackSettings | null {
  const parsed = readJson(PLAYBACK_SETTINGS_KEY, storage);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const source = parsed as Partial<PlaybackSettings>;
  const volume = clampUnit(source.volume);
  const playbackRate = clampRate(source.playbackRate);
  if (volume === null && playbackRate === null && source.muted !== true) return null;
  return {
    volume: volume ?? 1,
    playbackRate: playbackRate ?? 1,
    muted: source.muted === true,
  };
}

export function savePlaybackSettings(settings: PlaybackSettings, storage?: PlaybackStore): void {
  const volume = clampUnit(settings.volume);
  const playbackRate = clampRate(settings.playbackRate);
  if (volume === null || playbackRate === null) return;
  writeJson(
    PLAYBACK_SETTINGS_KEY,
    { volume, playbackRate, muted: settings.muted === true },
    storage,
  );
}

export function readLessonPosition(lessonId: string, storage?: PlaybackStore): number | null {
  const id = cleanLessonId(lessonId);
  if (id === null) return null;
  const parsed = readJson(LESSON_POSITIONS_KEY, storage);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  return clampTime((parsed as Record<string, unknown>)[id]);
}

export function saveLessonPosition(
  lessonId: string,
  seconds: number,
  storage?: PlaybackStore,
): void {
  const id = cleanLessonId(lessonId);
  const time = clampTime(seconds);
  if (id === null || time === null) return;
  const parsed = readJson(LESSON_POSITIONS_KEY, storage);
  const positions: Record<string, number> = {};
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
    for (const [key, value] of Object.entries(parsed)) {
      const keptId = cleanLessonId(key);
      const keptTime = clampTime(value);
      if (keptId !== null && keptTime !== null) positions[keptId] = keptTime;
    }
  }
  positions[id] = time;
  writeJson(LESSON_POSITIONS_KEY, positions, storage);
}

/** Seconds from a copied lesson link, or null when this lesson is not the target. */
export function readTimestamp(href: string, lessonId: string): number | null {
  const url = parseUrl(href);
  if (url === null) return null;
  const owner = url.searchParams.get('savanna-lesson');
  if (owner !== null && owner !== lessonId) return null;
  const named = parseClock(url.searchParams.get('savanna-t'));
  if (named !== null) return named;
  if (owner !== null) return null;
  const plain = parseClock(url.searchParams.get('t'));
  if (plain !== null) return plain;
  const hash = url.hash.replace(/^#/, '');
  if (!hash.startsWith('t=')) return null;
  return parseClock(hash.slice(2));
}

/** Page URL that opens this lesson at `seconds`. The hash is left unchanged. */
export function withTimestamp(href: string, lessonId: string, seconds: number): string {
  const url = parseUrl(href) ?? new URL('http://localhost/');
  const time = clampTime(seconds);
  url.searchParams.set('savanna-t', String(time === null ? 0 : Math.floor(time)));
  url.searchParams.set('savanna-lesson', lessonId);
  return url.href;
}

function parseUrl(href: string): URL | null {
  try {
    return new URL(href, 'http://localhost/');
  } catch {
    return null;
  }
}

function parseClock(value: string | null): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return clampTime(Number(trimmed));
  const parts = trimmed.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((part) => /^\d+(?:\.\d+)?$/.test(part))) return null;
  const numbers = parts.map(Number);
  const seconds =
    numbers.length === 3
      ? numbers[0]! * 3600 + numbers[1]! * 60 + numbers[2]!
      : numbers[0]! * 60 + numbers[1]!;
  return clampTime(seconds);
}

function clampUnit(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

function clampRate(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > MAX_RATE) {
    return null;
  }
  return value;
}

function clampTime(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function cleanLessonId(value: string): string | null {
  const id = value.trim();
  if (id === '' || id.length > LESSON_ID_LIMIT) return null;
  return id;
}

function readJson(key: string, storage?: PlaybackStore): unknown {
  try {
    const raw = resolveStore(storage).getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown, storage?: PlaybackStore): void {
  try {
    resolveStore(storage).setItem(key, JSON.stringify(value));
  } catch {
    // Private mode and blocked storage leave playback unsaved.
  }
}

function resolveStore(storage?: PlaybackStore): PlaybackStore {
  const unavailable: PlaybackStore = { getItem: () => null, setItem: () => undefined };
  if (storage) return storage;
  try {
    if (typeof localStorage === 'undefined') return unavailable;
    return localStorage;
  } catch {
    return unavailable;
  }
}
