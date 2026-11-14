export interface CaptionSettings {
  enabled: boolean;
  language: string;
  /** Relative font scale, 1 = default size. */
  fontScale: number;
  textColor: string;
  backgroundColor: string;
  highContrast: boolean;
}

export const DEFAULT_CAPTION_SETTINGS: Readonly<CaptionSettings> = Object.freeze({
  enabled: true,
  language: 'en',
  fontScale: 1,
  textColor: '#ffffff',
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
  highContrast: false,
});
