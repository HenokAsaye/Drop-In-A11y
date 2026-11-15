export interface CaptionSettings {
  enabled: boolean;
  language: string;
  fontScale: number;
  textColor: string;
  backgroundColor: string;
  highContrast: boolean;
}

export const EMPTY_LESSON_MESSAGE = 'This lesson has no video.';

export const LESSON_LOAD_FAILURE_MESSAGE = 'The lesson could not be loaded.';

export const SEEK_STEP_SECONDS = 5;

export const VOLUME_STEP = 0.1;

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;

export const DEFAULT_CAPTION_SETTINGS: Readonly<CaptionSettings> = Object.freeze({
  enabled: true,
  language: 'en',
  fontScale: 1,
  textColor: '#ffffff',
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
  highContrast: false,
});

export const MIN_CAPTION_FONT_SCALE = 0.75;
export const MAX_CAPTION_FONT_SCALE = 2;

export const HIGH_CONTRAST_TEXT_COLOR = '#000000';
export const HIGH_CONTRAST_BACKGROUND_COLOR = '#ffff00';

export const CAPTION_BACKGROUND_SWATCH = '#000000';

export const CAPTION_SETTINGS_KEY = 'savanna.captionSettings';

/** Device-wide playback speed, volume, and mute. Stored beside caption settings. */
export const PLAYBACK_SETTINGS_KEY = 'savanna.playbackSettings';

/** Last playback position, keyed by lesson id, on this device only. */
export const LESSON_POSITIONS_KEY = 'savanna.lessonPositions';

/** Sentence bookmarks, keyed by lesson id and transcript language, on this device only. */
export const LESSON_BOOKMARKS_KEY = 'savanna.lessonBookmarks';

export const CAPTION_FONT_FAMILY =
  '"Noto Sans Ethiopic", "Abyssinica SIL", "Nyala", "Ebrima", sans-serif';

export const CAPTION_BASE_FONT_SIZE = '16px';

export const ETHIOPIC_FONT_LINK_ID = 'savanna-ethiopic-font';

export const ETHIOPIC_FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Ethiopic&display=swap';
