import type { CaptionTrack } from '@savanna/contracts';

import {
  CAPTION_BASE_FONT_SIZE,
  CAPTION_FONT_FAMILY,
  ETHIOPIC_FONT_HREF,
  ETHIOPIC_FONT_LINK_ID,
  HIGH_CONTRAST_BACKGROUND_COLOR,
  HIGH_CONTRAST_TEXT_COLOR,
  type CaptionSettings,
} from '../config';
import { sanitizeCaptionSettings } from './caption-settings';

export class CaptionManager {
  private settings: CaptionSettings = sanitizeCaptionSettings(undefined);

  constructor(protected readonly video: HTMLVideoElement) {}

  manages(video: HTMLVideoElement): boolean {
    return this.video === video;
  }

  loadTracks(tracks: CaptionTrack[]): void {
    this.video.querySelectorAll('track[data-savanna-caption]').forEach((track) => track.remove());
    for (const track of tracks) {
      const language = track.language.trim();
      const url = track.url.trim();
      if (language === '' || url === '') continue;
      const element = document.createElement('track');
      element.kind = 'captions';
      element.srclang = language;
      element.label = track.label.trim() || language;
      element.src = url;
      element.dataset.savannaCaption = '';
      element.addEventListener('load', () => this.applyMode());
      this.video.append(element);
    }
    this.applyMode();
  }

  apply(settings: CaptionSettings): void {
    this.settings = sanitizeCaptionSettings(settings);
    this.applyMode();
    this.applyCueStyle();
    ensureEthiopicFont();
  }

  private applyMode(): void {
    const tracks = this.video.querySelectorAll<HTMLTrackElement>('track[data-savanna-caption]');
    let shown = false;
    for (const element of tracks) {
      const selected =
        this.settings.enabled && !shown && sameLanguage(element.srclang, this.settings.language);
      if (selected) shown = true;
      element.default = selected;
      const textTrack = element.track;
      if (textTrack) textTrack.mode = selected ? 'showing' : 'disabled';
    }
  }

  private applyCueStyle(): void {
    const text = this.settings.highContrast ? HIGH_CONTRAST_TEXT_COLOR : this.settings.textColor;
    const background = this.settings.highContrast
      ? HIGH_CONTRAST_BACKGROUND_COLOR
      : this.settings.backgroundColor;
    const scale = Math.round(this.settings.fontScale * 100);
    const style = this.cueStyleElement();
    style.textContent = [
      '.lesson-video::cue {',
      `  font-family: ${CAPTION_FONT_FAMILY};`,
      `  font-size: ${scale}%;`,
      `  color: ${text};`,
      `  background-color: ${background};`,
      '}',
    ].join('\n');
    this.video.style.fontSize = CAPTION_BASE_FONT_SIZE;
    this.video.style.fontFamily = CAPTION_FONT_FAMILY;
  }

  private cueStyleElement(): HTMLStyleElement {
    const root = this.video.getRootNode();
    const parent: ParentNode = root instanceof ShadowRoot ? root : document.head;
    const existing = parent.querySelector<HTMLStyleElement>('style[data-savanna-cues]');
    if (existing) return existing;
    const style = document.createElement('style');
    style.dataset.savannaCues = '';
    parent.append(style);
    return style;
  }
}

export function ensureEthiopicFont(doc: Document = document): void {
  if (doc.getElementById(ETHIOPIC_FONT_LINK_ID)) return;
  const head = doc.head;
  if (!head) return;
  const link = doc.createElement('link');
  link.id = ETHIOPIC_FONT_LINK_ID;
  link.rel = 'stylesheet';
  link.href = ETHIOPIC_FONT_HREF;
  head.append(link);
}

function sameLanguage(trackLanguage: string, selected: string): boolean {
  return trackLanguage.trim().toLowerCase() === selected.trim().toLowerCase();
}
