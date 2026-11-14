import {
  CAPTION_SETTINGS_KEY,
  DEFAULT_CAPTION_SETTINGS,
  MAX_CAPTION_FONT_SCALE,
  MIN_CAPTION_FONT_SCALE,
  type CaptionSettings,
} from '../config';

export type { CaptionSettings };
export {
  CAPTION_SETTINGS_KEY,
  DEFAULT_CAPTION_SETTINGS,
  MAX_CAPTION_FONT_SCALE,
  MIN_CAPTION_FONT_SCALE,
};

const SAFE_COLOR =
  /^(?:#[0-9a-fA-F]{3}|#[0-9a-fA-F]{4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\))$/;

const LANGUAGE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/;

export interface CaptionSettingsStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function sanitizeCaptionSettings(
  input: Partial<CaptionSettings> | null | undefined,
): CaptionSettings {
  const source = input ?? {};
  return {
    enabled:
      typeof source.enabled === 'boolean' ? source.enabled : DEFAULT_CAPTION_SETTINGS.enabled,
    language: cleanLanguage(source.language),
    fontScale: clampFontScale(source.fontScale),
    textColor: safeColor(source.textColor, DEFAULT_CAPTION_SETTINGS.textColor),
    backgroundColor: safeColor(source.backgroundColor, DEFAULT_CAPTION_SETTINGS.backgroundColor),
    highContrast:
      typeof source.highContrast === 'boolean'
        ? source.highContrast
        : DEFAULT_CAPTION_SETTINGS.highContrast,
  };
}

export function captionColorInputValue(color: string, fallback: string): string {
  const full = /^#([0-9a-fA-F]{6})$/.exec(color.trim());
  if (full?.[1]) return `#${full[1].toLowerCase()}`;
  const short = /^#([0-9a-fA-F]{3})$/.exec(color.trim());
  if (!short?.[1]) return fallback;
  const [red, green, blue] = short[1];
  return `#${red}${red}${green}${green}${blue}${blue}`.toLowerCase();
}

export function readStoredCaptionSettings(storage?: CaptionSettingsStore): CaptionSettings | null {
  try {
    const raw = resolveStore(storage).getItem(CAPTION_SETTINGS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return sanitizeCaptionSettings(parsed as Partial<CaptionSettings>);
  } catch {
    return null;
  }
}

export function loadCaptionSettings(storage?: CaptionSettingsStore): CaptionSettings {
  return readStoredCaptionSettings(storage) ?? { ...DEFAULT_CAPTION_SETTINGS };
}

export function saveCaptionSettings(
  settings: CaptionSettings,
  storage?: CaptionSettingsStore,
): void {
  resolveStore(storage).setItem(
    CAPTION_SETTINGS_KEY,
    JSON.stringify(sanitizeCaptionSettings(settings)),
  );
}

function resolveStore(storage?: CaptionSettingsStore): CaptionSettingsStore {
  const unavailable: CaptionSettingsStore = { getItem: () => null, setItem: () => undefined };
  if (storage) return storage;
  try {
    if (typeof localStorage === 'undefined') return unavailable;
    return localStorage;
  } catch {
    return unavailable;
  }
}

function cleanLanguage(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_CAPTION_SETTINGS.language;
  const language = value.trim().toLowerCase();
  return LANGUAGE.test(language) ? language : DEFAULT_CAPTION_SETTINGS.language;
}

function clampFontScale(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_CAPTION_SETTINGS.fontScale;
  }
  return Math.min(MAX_CAPTION_FONT_SCALE, Math.max(MIN_CAPTION_FONT_SCALE, value));
}

function safeColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const color = value.trim();
  return SAFE_COLOR.test(color) ? color : fallback;
}
