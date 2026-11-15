import {
  PLAYER_TAG,
  type Lesson,
  type PlayerStatus,
  type TranscriptSegment,
} from '@savanna/contracts';
import {
  DownloadManager,
  OfflineStorage,
  type DownloadStatus,
  type OfflineMode,
} from '@savanna/offline';
import { LitElement, css, html, nothing, unsafeCSS, type PropertyValues } from 'lit';

import { Announcer } from '../accessibility/announcer';
import { resolveShortcut } from '../accessibility/keyboard-shortcuts';
import { LessonClient } from '../api/lesson-client';
import { CaptionManager } from '../captions/caption-manager';
import {
  captionColorInputValue,
  readStoredCaptionSettings,
  sanitizeCaptionSettings,
  saveCaptionSettings,
} from '../captions/caption-settings';
import {
  CAPTION_BACKGROUND_SWATCH,
  CAPTION_FONT_FAMILY,
  DEFAULT_CAPTION_SETTINGS,
  LESSON_LOAD_FAILURE_MESSAGE,
  MAX_CAPTION_FONT_SCALE,
  MIN_CAPTION_FONT_SCALE,
  PLAYBACK_RATES,
  SEEK_STEP_SECONDS,
  VOLUME_STEP,
  type CaptionSettings,
} from '../config';
import { AudioDescriptionTrack } from '../audio-description/audio-description-track';
import {
  lessonDocumentLinks,
  lessonDocumentStyles,
  renderLessonDocuments,
  type LessonDocumentLink,
} from '../documents/lesson-documents';
import { MediaController } from '../media/media-controller';
import { MediaSync } from '../media/media-sync';
import {
  addBookmark,
  readBookmarks,
  removeBookmark,
  type BookmarkWriteStatus,
  type SentenceBookmark,
} from '../playback/bookmarks';
import {
  readLessonPosition,
  readPlaybackSettings,
  readTimestamp,
  saveLessonPosition,
  savePlaybackSettings,
  withTimestamp,
} from '../playback/playback-memory';
import { interfaceText, uiLanguage, type LabelKey } from '../labels';
import {
  FORCED_COLORS_QUERY,
  REDUCED_MOTION_QUERY,
  mediaMatches,
  watchMedia,
} from '../media-preferences';
import { SIGN_LANGUAGE_TAG, type SignLanguageWindow } from '../sign-language/sign-language-window';
import { transcriptDocument, transcriptFilename } from '../transcript/transcript-export';
import '../transcript/transcript-panel';
import type {
  TranscriptBookmarkDetail,
  TranscriptLanguageDetail,
  TranscriptSeekDetail,
} from '../transcript/transcript-panel';

const OFFLINE_MODES: { mode: OfflineMode; label: LabelKey; item: LabelKey }[] = [
  { mode: 'audio', label: 'downloadAudio', item: 'audioOnly' },
  { mode: 'text', label: 'downloadText', item: 'textOnly' },
  { mode: 'full', label: 'downloadAll', item: 'everything' },
];

type OfflineNotice =
  | { kind: 'idle' }
  | { kind: 'downloading'; file: string; percent: number }
  | { kind: 'downloaded'; item: LabelKey }
  | { kind: 'no-worker' }
  | { kind: 'failed' }
  | { kind: 'available'; item: LabelKey }
  | { kind: 'removed' };

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function readableChapters(
  chapters: Lesson['chapters'] | null | undefined,
): { name: string; start: number }[] {
  if (!Array.isArray(chapters)) return [];
  const readable: { name: string; start: number }[] = [];
  for (const chapter of chapters) {
    if (chapter === null || typeof chapter !== 'object') continue;
    const name = typeof chapter.name === 'string' ? chapter.name.trim() : '';
    const start = chapter.start;
    if (name === '' || typeof start !== 'number' || !Number.isFinite(start) || start < 0) continue;
    readable.push({ name, start });
  }
  return readable;
}

function bookmarkNoticeKey(status: BookmarkWriteStatus): LabelKey | '' {
  switch (status) {
    case 'added':
      return 'bookmarkSaved';
    case 'removed':
      return 'bookmarkRemoved';
    case 'duplicate':
      return 'bookmarkDuplicate';
    case 'limit':
      return 'bookmarkLimit';
    case 'unavailable':
      return 'bookmarkUnavailable';
    default:
      return '';
  }
}

/**
 * <savanna-player lesson-id="..." api-base="..."> — the single entry point host websites embed.
 * Loads lesson metadata from api-base and exposes loading, ready, empty, and error states.
 */
export class SavannaPlayer extends LitElement {
  static override properties = {
    lessonId: { type: String, attribute: 'lesson-id', reflect: true },
    apiBase: { type: String, attribute: 'api-base', reflect: true },
    captionLanguage: { type: String, attribute: 'caption-language' },
    lang: { type: String },
    reducedMotion: { type: Boolean, reflect: true, attribute: 'reduced-motion' },
    swUrl: { type: String, attribute: 'sw-url' },
    status: { state: true },
    lesson: { state: true },
    videoSrc: { state: true },
    isPaused: { state: true },
    isMuted: { state: true },
    volume: { state: true },
    currentTime: { state: true },
    duration: { state: true },
    playbackRate: { state: true },
    isFullscreen: { state: true },
    offlineStatus: { state: true },
    offlineMessage: { state: true },
    offlineItem: { state: true },
    transcriptMessage: { state: true },
    transcriptLanguage: { state: true },
    transcriptSegments: { state: true },
    captionSettings: { state: true },
    resumeOffer: { state: true },
    linkMessage: { state: true },
    signLanguageOpen: { state: true },
    signLanguageSrc: { state: true },
    audioDescriptionEnabled: { state: true },
    shortcutHelpOpen: { state: true },
    bookmarks: { state: true },
    bookmarkNotice: { state: true },
    exportNotice: { state: true },
    textLessonOpen: { state: true },
  };

  static override styles = css`
    :host {
      display: block;
      font: inherit;
      color: inherit;
      line-height: 1.5;
      box-sizing: border-box;
    }

    :host([hidden]) {
      display: none;
    }

    *,
    *::before,
    *::after {
      box-sizing: inherit;
    }

    section {
      min-height: 1.5em;
    }

    .status {
      margin: 0;
      max-width: 42rem;
      overflow-wrap: anywhere;
    }

    .player-container {
      position: relative;
      display: flex;
      flex-direction: column;
      width: 100%;
      background: #000;
      color: #fff;
      border-radius: 8px;
      overflow: hidden;
    }

    .video-wrapper {
      position: relative;
      width: 100%;
      background: #000;
    }

    video {
      display: block;
      width: 100%;
      height: auto;
      max-height: 80vh;
    }

    .controls-toolbar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      background: rgba(15, 23, 42, 0.95);
      color: #f8fafc;
      flex-wrap: wrap;
    }

    .control-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 2.5rem;
      min-height: 2.5rem;
      padding: 0.25rem 0.5rem;
      background: transparent;
      color: #f8fafc;
      border: 1px solid transparent;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
      font-family: inherit;
      line-height: 1;
    }

    .control-btn:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    button[aria-pressed='true'] {
      background: rgba(56, 189, 248, 0.2);
      border-color: #38bdf8;
    }

    button:focus-visible,
    a:focus-visible,
    input:focus-visible,
    select:focus-visible {
      outline: 2px solid #38bdf8;
      outline-offset: 2px;
    }

    .shortcut-help {
      margin: 0.75rem 0 0;
      padding: 0.75rem 1rem;
      background: #0f172a;
      color: #f8fafc;
      border-radius: 8px;
    }

    .shortcut-help[hidden] {
      display: none;
    }

    .shortcut-help ul {
      margin: 0;
      padding-left: 1.25rem;
    }

    :host([reduced-motion]),
    :host([reduced-motion]) * {
      scroll-behavior: auto !important;
      transition: none !important;
      animation: none !important;
    }

    .seek-container {
      display: flex;
      align-items: center;
      flex: 1;
      min-width: 140px;
      gap: 0.5rem;
    }

    .control-range {
      flex: 1;
      min-width: 0;
      height: 24px;
      cursor: pointer;
      accent-color: #38bdf8;
      background: transparent;
    }

    .volume-container {
      display: flex;
      align-items: center;
      width: 100px;
      min-width: 60px;
    }

    .time-display,
    .copy-status {
      font-size: 0.875rem;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    .resume-btn,
    .copy-link-btn {
      width: auto;
      padding-inline: 0.75rem;
      font-size: 0.875rem;
      white-space: nowrap;
    }

    .offline {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      flex-wrap: wrap;
      background: rgba(15, 23, 42, 0.95);
      color: #f8fafc;
    }

    .offline .control-btn {
      border-color: #94a3b8;
    }

    .offline [aria-disabled='true'] {
      opacity: 0.6;
      cursor: progress;
    }

    .offline-status,
    .offline-badge,
    .transcript-status {
      margin: 0;
      flex-basis: 100%;
      font-size: 0.875rem;
    }

    .offline-badge {
      font-weight: 600;
    }

    .offline-progress {
      flex-basis: 100%;
      width: 100%;
      height: 0.5rem;
      accent-color: #38bdf8;
    }

    .retry-btn {
      width: auto;
      margin: 0.5rem 0.5rem 0;
      padding-inline: 0.75rem;
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .caption-settings {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem 1rem;
      width: 100%;
      min-width: 0;
      margin: 0;
      padding: 0.5rem;
      border: 0;
      border-top: 1px solid rgba(148, 163, 184, 0.4);
      background: rgba(15, 23, 42, 0.95);
      color: #f8fafc;
      font-family: ${unsafeCSS(CAPTION_FONT_FAMILY)};
    }

    .caption-settings legend {
      padding: 0;
      font-size: 0.875rem;
      font-weight: 600;
    }

    .caption-field {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      min-height: 2.5rem;
      font-size: 0.875rem;
    }

    .caption-settings select {
      min-width: 2.5rem;
      min-height: 2.5rem;
      padding: 0.25rem 0.5rem;
      color: #f8fafc;
      background: #0f172a;
      border: 1px solid #94a3b8;
      border-radius: 4px;
      font: inherit;
    }

    .caption-settings input[type='checkbox'] {
      width: 1.5rem;
      height: 1.5rem;
      min-width: 1.5rem;
      min-height: 1.5rem;
      margin: 0;
      accent-color: #38bdf8;
    }

    .caption-size {
      flex: none;
      width: 8rem;
      min-width: 6rem;
      height: 24px;
    }

    .caption-value {
      min-width: 3rem;
      font-size: 0.875rem;
      font-variant-numeric: tabular-nums;
    }

    .caption-color {
      width: 2.5rem;
      height: 2.5rem;
      min-width: 2.5rem;
      min-height: 2.5rem;
      padding: 0.125rem;
      border: 1px solid #94a3b8;
      border-radius: 4px;
      background: #0f172a;
      cursor: pointer;
    }

    .reading-tools,
    .chapters,
    .bookmarks,
    .text-lesson {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-width: 0;
      padding: 0.75rem 0.5rem;
      border-top: 1px solid rgba(148, 163, 184, 0.4);
      background: rgba(15, 23, 42, 0.95);
      color: #f8fafc;
    }

    .reading-tools {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
    }

    .chapters h2,
    .bookmarks h2,
    .text-lesson h2 {
      margin: 0;
      font-size: 0.875rem;
      font-weight: 600;
      line-height: 1.4;
    }

    .chapters ol,
    .bookmarks ul,
    .text-lesson-transcript {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin: 0;
      padding: 0;
      list-style: none;
      min-width: 0;
    }

    .chapter-btn,
    .bookmark-btn,
    .text-lesson-sentence,
    .bookmark-remove,
    .text-lesson-bookmark,
    .reading-tools .control-btn {
      max-width: 100%;
      white-space: normal;
      overflow-wrap: anywhere;
      text-align: start;
    }

    .chapter-btn,
    .bookmark-btn,
    .text-lesson-sentence {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 0.25rem 0.75rem;
      width: 100%;
      min-height: 2.5rem;
      padding: 0.5rem 0.75rem;
      background: transparent;
      color: inherit;
      border: 1px solid transparent;
      border-radius: 4px;
      cursor: pointer;
      font: inherit;
    }

    .bookmark-row,
    .text-lesson-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem;
      min-width: 0;
    }

    .bookmark-btn,
    .text-lesson-sentence {
      flex: 1 1 12rem;
      width: auto;
    }

    .chapter-time,
    .sentence-time {
      font-variant-numeric: tabular-nums;
    }

    .reading-status,
    .bookmark-status,
    .bookmark-empty,
    .text-lesson-empty {
      margin: 0;
      flex-basis: 100%;
      min-width: 0;
      font-size: 0.875rem;
      overflow-wrap: anywhere;
    }

    ${lessonDocumentStyles}
  `;

  declare lessonId: string;
  declare apiBase: string;
  declare captionLanguage: string;
  declare lang: string;
  declare reducedMotion: boolean;
  declare swUrl: string;
  declare status: PlayerStatus;
  declare lesson: Lesson | null;
  declare videoSrc: string;
  declare isPaused: boolean;
  declare isMuted: boolean;
  declare volume: number;
  declare currentTime: number;
  declare duration: number;
  declare playbackRate: number;
  declare isFullscreen: boolean;
  declare offlineStatus: DownloadStatus;
  declare offlineMessage: string;
  /** Package stored on this device, named with a label key such as `audioOnly`. */
  declare offlineItem: LabelKey | null;
  declare transcriptMessage: string;

  /** Offline download manager; created on first use, or supplied by a host or a test. */
  offlineManager: DownloadManager | undefined;
  declare transcriptLanguage: 'en' | 'am';
  declare transcriptSegments: TranscriptSegment[];
  declare captionSettings: CaptionSettings;
  /** Saved position to offer, in seconds. Null when there is nothing to resume. */
  declare resumeOffer: number | null;
  declare linkMessage: string;
  declare signLanguageOpen: boolean;
  declare signLanguageSrc: string;
  declare audioDescriptionEnabled: boolean;
  declare shortcutHelpOpen: boolean;
  declare bookmarks: SentenceBookmark[];
  declare bookmarkNotice: LabelKey | '';
  declare exportNotice: LabelKey | '';
  declare textLessonOpen: boolean;

  private abortController: AbortController | null = null;
  private requestId = 0;
  private transcriptRequestId = 0;
  private statusMessage = '';
  private statusAnnouncer: Announcer | null = null;
  private errorAnnouncer: Announcer | null = null;
  private connectedOnce = false;
  private _controller: MediaController | null = null;
  private captionManager: CaptionManager | null = null;
  private captionPreferencesLoaded = false;
  private captionChoiceStored = false;
  private playbackPreferencesLoaded = false;
  private applyingPlayback = false;
  private playbackApplied = false;
  private positionWrites = false;
  private positionTouched = false;
  private lastSavedPositionSecond = -1;
  private lastProgressSecond = -1;
  private playbackStartToken = '';
  private readyNotifiedFor = '';
  private mediaSync: MediaSync | null = null;
  private signLanguageDetach: (() => void) | null = null;
  private audioDescription: AudioDescriptionTrack | null = null;
  private documentLinks: LessonDocumentLink[] = [];
  private mediaUnsubscribers: Array<() => void> = [];
  private linkState: '' | 'copied' | 'failed' = '';
  private offlineNotice: OfflineNotice = { kind: 'idle' };
  private failedDownloadMode: OfflineMode | null = null;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const action = resolveShortcut(event, this);
    if (!action) return;
    switch (action) {
      case 'toggle-play':
        void this.togglePlay();
        break;
      case 'seek-backward':
        this.controller?.seekBy(-SEEK_STEP_SECONDS);
        this.noteUserSeek();
        break;
      case 'seek-forward':
        this.controller?.seekBy(SEEK_STEP_SECONDS);
        this.noteUserSeek();
        break;
      case 'volume-up':
        this.controller?.changeVolume(VOLUME_STEP);
        break;
      case 'volume-down':
        this.controller?.changeVolume(-VOLUME_STEP);
        break;
      case 'toggle-mute':
        this.toggleMute();
        break;
      case 'toggle-fullscreen':
        void this.toggleFullscreen();
        break;
    }
  };

  constructor() {
    super();
    this.lessonId = '';
    this.apiBase = '';
    this.captionLanguage = 'en';
    this.lang = '';
    this.reducedMotion = false;
    this.swUrl = '/savanna-sw.js';
    this.status = 'idle';
    this.lesson = null;
    this.videoSrc = '';
    this.isPaused = true;
    this.isMuted = false;
    this.volume = 1;
    this.currentTime = 0;
    this.duration = 0;
    this.playbackRate = 1;
    this.isFullscreen = false;
    this.offlineStatus = 'not-downloaded';
    this.offlineMessage = '';
    this.offlineItem = null;
    this.transcriptMessage = '';
    this.transcriptLanguage = 'en';
    this.transcriptSegments = [];
    this.captionSettings = { ...DEFAULT_CAPTION_SETTINGS };
    this.resumeOffer = null;
    this.linkMessage = '';
    this.signLanguageOpen = false;
    this.signLanguageSrc = '';
    this.audioDescriptionEnabled = false;
    this.shortcutHelpOpen = false;
    this.bookmarks = [];
    this.bookmarkNotice = '';
    this.exportNotice = '';
    this.textLessonOpen = false;
  }

  private text(key: LabelKey, values?: Record<string, string | number>): string {
    return interfaceText(this.lang, key, values);
  }

  get videoElement(): HTMLVideoElement | null {
    return this.renderRoot?.querySelector('video') ?? null;
  }

  get signLanguageWindow(): SignLanguageWindow | null {
    return this.renderRoot?.querySelector<SignLanguageWindow>(SIGN_LANGUAGE_TAG) ?? null;
  }

  get audioDescriptionElement(): HTMLAudioElement | null {
    return this.audioDescription?.enabled ? this.audioDescription.element : null;
  }

  get controller(): MediaController | null {
    const video = this.videoElement;
    if (video && (!this._controller || this._controller['video'] !== video)) {
      this._controller = new MediaController(video);
    }
    return this._controller;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.publishFocusPart();
    this.bindMediaPreferences();
    this.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
    if (this.connectedOnce) this.beginLoad();
    this.connectedOnce = true;
  }

  override disconnectedCallback(): void {
    this.releaseMediaPreferences();
    this.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    this.releaseAudioDescription();
    this.signLanguageDetach?.();
    this.signLanguageDetach = null;
    this.mediaSync?.dispose();
    this.mediaSync = null;
    if (this.positionTouched) this.rememberPosition(this.currentTime, true);
    this.abortController?.abort();
    this.abortController = null;
    this.transcriptRequestId += 1;
    super.disconnectedCallback();
  }

  private publishFocusPart(): void {
    const names = (this.getAttribute('exportparts') ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '');
    if (names.includes('focus-ring')) return;
    names.push('focus-ring');
    this.setAttribute('exportparts', names.join(', '));
  }

  private bindMediaPreferences(): void {
    this.reducedMotion = mediaMatches(REDUCED_MOTION_QUERY);
    this.mediaUnsubscribers.push(
      watchMedia(FORCED_COLORS_QUERY, (matches) => this.applyForcedColors(matches)),
      watchMedia(REDUCED_MOTION_QUERY, (matches) => {
        this.reducedMotion = matches;
      }),
    );
  }

  private releaseMediaPreferences(): void {
    for (const unsubscribe of this.mediaUnsubscribers) unsubscribe();
    this.mediaUnsubscribers = [];
  }

  private applyForcedColors(matches: boolean): void {
    if (!this.captionPreferencesLoaded || this.captionChoiceStored) return;
    if (this.captionSettings.highContrast === matches) return;
    this.captionSettings = sanitizeCaptionSettings({
      ...this.captionSettings,
      highContrast: matches,
    });
  }

  private refreshInterfaceMessages(): void {
    if (this.linkState === 'copied') this.linkMessage = this.text('linkCopied');
    if (this.linkState === 'failed') this.linkMessage = this.text('linkCopyFailed');
    this.applyOfflineNotice();
    if (this.transcriptMessage !== '') this.transcriptMessage = this.text('transcriptFailed');
    if (this.status === 'loading') {
      this.statusMessage = this.text('loadingLesson', { id: this.lessonId.trim() });
    } else if (this.lesson && (this.status === 'ready' || this.status === 'empty')) {
      this.statusMessage = describeLesson(this.lesson, this.lang).message;
    }
  }

  private applyOfflineNotice(): void {
    const notice = this.offlineNotice;
    switch (notice.kind) {
      case 'downloading':
        this.offlineMessage =
          notice.file === ''
            ? this.text('downloading')
            : this.text('downloadingFile', { file: notice.file, percent: String(notice.percent) });
        break;
      case 'downloaded':
        this.offlineMessage = this.text('downloadedForOffline', { item: this.text(notice.item) });
        break;
      case 'no-worker':
        this.offlineMessage = this.text('noWorker');
        break;
      case 'failed':
        this.offlineMessage = this.text('downloadFailed');
        break;
      case 'available':
        this.offlineMessage = this.text('offlineBadge', { item: this.text(notice.item) });
        break;
      case 'removed':
        this.offlineMessage = this.text('offlineRemoved');
        break;
      default:
        this.offlineMessage = '';
        break;
    }
  }

  private handleFullscreenChange = (): void => {
    this.isFullscreen = Boolean(document.fullscreenElement);
  };

  override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('captionLanguage')) {
      this.transcriptLanguage = transcriptLanguageOf(this.captionLanguage);
    }
    this.restoreCaptionSettings(changed);
    this.restorePlaybackPreferences();
    if (changed.has('lesson')) {
      this.signLanguageSrc = this.lesson?.media?.signLanguage ?? this.signLanguageSrc;
      this.documentLinks = lessonDocumentLinks(this.lesson?.documents, document.baseURI);
    }
    if (changed.has('lessonId') || changed.has('apiBase')) this.beginLoad();
    if (
      changed.has('lessonId') ||
      changed.has('apiBase') ||
      changed.has('transcriptLanguage') ||
      changed.has('captionLanguage')
    ) {
      this.bookmarks = readBookmarks(this.lessonId, this.transcriptLanguage);
    }
    if (changed.has('lang')) this.refreshInterfaceMessages();
    const transcriptInputChanged =
      changed.has('status') || changed.has('captionLanguage') || changed.has('transcriptLanguage');
    if (this.status === 'ready' && transcriptInputChanged) void this.loadTranscript();
  }

  override updated(changed: PropertyValues<this>): void {
    this.syncAnnouncement();
    this.syncCaptions(changed);
    if (changed.has('signLanguageOpen') || changed.has('lesson')) {
      void this.syncSignLanguage();
    }
    if (changed.has('audioDescriptionEnabled') || changed.has('lesson')) {
      this.syncAudioDescription();
    }
    if (changed.has('status') || changed.has('lesson') || changed.has('videoSrc')) {
      this.syncPlaybackStart();
    }
  }

  togglePlay = async (): Promise<void> => {
    await this.controller?.togglePlay();
    this.isPaused = this.videoElement?.paused ?? true;
  };

  toggleMute = (): void => {
    this.controller?.toggleMute();
    if (this.videoElement) {
      this.isMuted = this.videoElement.muted;
      this.volume = this.videoElement.volume;
    } else {
      this.isMuted = !this.isMuted;
    }
    this.rememberPlayback();
  };

  handleSeekInput = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    const value = parseFloat(target.value);
    this.controller?.seekTo(value);
    this.noteUserSeek(value);
  };

  handleVolumeInput = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    const value = parseFloat(target.value);
    if (this.videoElement) {
      this.videoElement.volume = value;
      if (value > 0 && this.videoElement.muted) {
        this.videoElement.muted = false;
      }
      this.volume = this.videoElement.volume;
      this.isMuted = this.videoElement.muted;
    } else {
      this.volume = value;
      if (value > 0) this.isMuted = false;
    }
    this.rememberPlayback();
  };

  cyclePlaybackSpeed = (): void => {
    const speeds: readonly number[] = PLAYBACK_RATES;
    const currentIndex = speeds.indexOf(this.playbackRate);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length] ?? 1;
    this.controller?.setPlaybackRate(nextSpeed);
    this.playbackRate = nextSpeed;
    this.rememberPlayback();
  };

  toggleFullscreen = async (): Promise<void> => {
    const container = (this.renderRoot?.querySelector('.player-container') as HTMLElement) ?? this;
    await this.controller?.toggleFullscreen(container);
    this.isFullscreen = Boolean(document.fullscreenElement);
  };

  toggleSignLanguage = (): void => {
    this.signLanguageOpen = !this.signLanguageOpen;
    void this.syncSignLanguage();
  };

  private handleSignLanguageClose = (): void => {
    this.signLanguageOpen = false;
    void this.syncSignLanguage();
  };

  toggleAudioDescription = (): void => {
    this.audioDescriptionEnabled = !this.audioDescriptionEnabled;
  };

  private get audioDescriptionSource(): string {
    const value = this.lesson?.media?.audioDescription;
    return typeof value === 'string' ? value.trim() : '';
  }

  private syncAudioDescription(): void {
    const source = this.audioDescriptionSource;
    if (source === '') {
      this.audioDescriptionEnabled = false;
      this.releaseAudioDescription();
      return;
    }
    if (!this.audioDescriptionEnabled) {
      this.releaseAudioDescription();
      return;
    }
    const video = this.videoElement;
    if (!video) return;
    if (!this.audioDescription || this.audioDescription.source !== source) {
      this.releaseAudioDescription();
      this.audioDescription = new AudioDescriptionTrack(source);
    }
    this.mediaSync ??= new MediaSync(video);
    this.audioDescription.enable(video, this.mediaSync);
  }

  private releaseAudioDescription(): void {
    this.audioDescription?.disable();
    this.audioDescription = null;
  }

  private async syncSignLanguage(): Promise<void> {
    if (!this.videoElement) return;
    const signWindow = this.signLanguageWindow;
    if (signWindow) {
      await signWindow.updateComplete;
    }
    const signVideo = signWindow?.videoElement;

    if (this.signLanguageOpen && signVideo) {
      this.mediaSync ??= new MediaSync(this.videoElement);
      this.signLanguageDetach?.();
      this.signLanguageDetach = this.mediaSync.attach(signVideo);
    } else if (!this.signLanguageOpen && this.signLanguageDetach) {
      this.signLanguageDetach();
      this.signLanguageDetach = null;
    }
  }

  private get supportsOffline(): boolean {
    return (
      this.offlineManager !== undefined ||
      (typeof indexedDB !== 'undefined' && typeof caches !== 'undefined')
    );
  }

  private get manager(): DownloadManager {
    this.offlineManager ??= new DownloadManager(new OfflineStorage());
    return this.offlineManager;
  }

  private downloadLesson = async (mode: OfflineMode): Promise<void> => {
    if (this.offlineStatus === 'downloading') return;
    this.offlineStatus = 'downloading';
    this.failedDownloadMode = mode;
    this.offlineNotice = { kind: 'downloading', file: '', percent: 0 };
    this.applyOfflineNotice();
    try {
      const pkg = await new LessonClient(this.apiBase.trim()).getOfflinePackage(
        this.lessonId.trim(),
      );
      await this.manager.download(pkg, mode, (progress) => {
        if (progress.status !== 'downloading') return;
        this.offlineNotice = {
          kind: 'downloading',
          file: progress.currentFile,
          percent: progress.percent,
        };
        this.applyOfflineNotice();
      });
      const item = OFFLINE_MODES.find((entry) => entry.mode === mode)?.item ?? 'everything';
      const playbackReady = await this.registerWorker();
      this.offlineItem = item;
      this.failedDownloadMode = null;
      this.offlineStatus = 'downloaded';
      this.offlineNotice = playbackReady ? { kind: 'downloaded', item } : { kind: 'no-worker' };
      this.applyOfflineNotice();
    } catch {
      this.offlineStatus = 'failed';
      this.offlineNotice = { kind: 'failed' };
      this.applyOfflineNotice();
    }
  };

  /** The service worker serves saved files while offline. It must live on the host's origin. */
  private async registerWorker(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) return false;
    try {
      await navigator.serviceWorker.register(this.swUrl);
      await navigator.serviceWorker.ready;
      return true;
    } catch {
      return false;
    }
  }

  private removeDownload = async (): Promise<void> => {
    await this.manager.remove(this.lessonId.trim());
    this.offlineItem = null;
    this.failedDownloadMode = null;
    this.offlineStatus = 'not-downloaded';
    this.offlineNotice = { kind: 'removed' };
    this.applyOfflineNotice();
  };

  private async refreshOfflineStatus(): Promise<void> {
    if (!this.supportsOffline) return;
    try {
      const stored = await this.manager.record(this.lessonId.trim());
      if (!stored) return;
      const item = OFFLINE_MODES.find((entry) => entry.mode === stored.mode)?.item ?? 'everything';
      this.offlineItem = item;
      this.offlineStatus = 'downloaded';
      this.offlineNotice = { kind: 'available', item };
      this.applyOfflineNotice();
    } catch {
      // Offline storage is optional; ignore failures and keep the download buttons.
    }
  }

  private get showRetry(): boolean {
    return (
      this.status === 'error' || this.transcriptMessage !== '' || this.offlineStatus === 'failed'
    );
  }

  private retryFailure = (): void => {
    if (this.status === 'error') {
      this.beginLoad();
      return;
    }
    if (this.transcriptMessage !== '') void this.loadTranscript();
    if (this.offlineStatus === 'failed' && this.failedDownloadMode !== null) {
      void this.downloadLesson(this.failedDownloadMode);
    }
  };

  private renderOfflineControls() {
    if (this.status !== 'ready' || !this.supportsOffline) return nothing;
    const busy = this.offlineStatus === 'downloading';
    return html`
      <div class="offline" role="group" aria-label=${this.text('offline')}>
        ${OFFLINE_MODES.map(
          ({ mode, label }) => html`
            <button
              type="button"
              class="control-btn offline-btn"
              part="focus-ring"
              data-mode=${mode}
              aria-disabled=${busy ? 'true' : 'false'}
              @click=${() => void this.downloadLesson(mode)}
            >
              ${this.text(label)}
            </button>
          `,
        )}
        ${
          this.offlineStatus === 'downloaded'
            ? html`<button
                type="button"
                class="control-btn offline-remove"
                part="focus-ring"
                @click=${() => void this.removeDownload()}
              >
                ${this.text('removeDownload')}
              </button>`
            : nothing
        }
        <p id="offline-status" class="offline-status" role="status" aria-live="polite">
          ${this.offlineMessage}
        </p>
        ${
          this.offlineNotice.kind === 'downloading'
            ? html`<progress
                class="offline-progress"
                max="100"
                value=${this.offlineNotice.percent}
                aria-hidden="true"
              ></progress>`
            : nothing
        }
        ${
          this.offlineItem
            ? html`<p class="offline-badge">
                ${this.text('offlineBadge', {
                  item: this.text(this.offlineItem),
                })}
              </p>`
            : nothing
        }
      </div>
    `;
  }
  private handleVideoPlay = (): void => {
    this.isPaused = false;
  };

  private handleVideoPause = (): void => {
    this.isPaused = true;
  };

  private handleVideoTimeUpdate = (): void => {
    if (!this.videoElement) return;
    this.currentTime = this.videoElement.currentTime;
    if (this.videoElement.paused || !this.positionWrites) return;
    this.rememberPosition(this.currentTime, false);
    this.emitProgress(false);
  };

  private handleVideoDurationChange = (): void => {
    if (this.videoElement) {
      this.duration = this.videoElement.duration;
    }
  };

  private handleVideoVolumeChange = (): void => {
    if (!this.videoElement || this.applyingPlayback) return;
    this.volume = this.videoElement.volume;
    this.isMuted = this.videoElement.muted;
    if (this.playbackApplied) this.rememberPlayback();
  };

  private handleVideoRateChange = (): void => {
    if (!this.videoElement || this.applyingPlayback) return;
    this.playbackRate = this.videoElement.playbackRate;
    if (this.playbackApplied) this.rememberPlayback();
  };

  private handleVideoLoadedMetadata = (): void => {
    const video = this.videoElement;
    if (!video || this.status !== 'ready') return;
    this.duration = Number.isFinite(video.duration) ? video.duration : this.duration;
    this.consumeStartTime(video);
  };

  private handleVideoEnded = (): void => {
    this.isPaused = true;
    if (this.videoElement) this.currentTime = this.videoElement.currentTime;
    this.rememberPosition(this.currentTime, true);
    const lessonId = this.lessonId.trim();
    if (lessonId !== '' && this.status === 'ready') {
      this.emitPlayback('savanna-completed', lessonId, this.currentTime);
    }
  };

  override render() {
    const failed = this.status === 'error';
    const videoSource = this.lesson?.media?.video ?? this.videoSrc;
    const signLanguageSource = this.lesson?.media?.signLanguage ?? this.signLanguageSrc;
    const audioDescriptionSource = this.audioDescriptionSource;
    return html`
      <section
        class="player-container"
        lang=${uiLanguage(this.lang)}
        aria-label=${this.text('lessonPlayer')}
        aria-busy=${this.status === 'loading' ? 'true' : nothing}
      >
        <p
          id="player-status"
          class="status"
          data-state=${failed ? nothing : this.status}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          ?hidden=${failed}
        ></p>
        <p id="player-error" class="status" role="alert" ?hidden=${!failed}></p>
        ${
          this.showRetry
            ? html`<button
                type="button"
                class="control-btn retry-btn"
                part="focus-ring"
                @click=${this.retryFailure}
              >
                ${this.text('retry')}
              </button>`
            : nothing
        }
        <div class="video-wrapper">
          <video
            class="lesson-video"
            src=${videoSource}
            playsinline
            crossorigin="anonymous"
            aria-label=${this.lesson?.title || this.text('lessonVideo')}
            @play=${this.handleVideoPlay}
            @pause=${this.handleVideoPause}
            @timeupdate=${this.handleVideoTimeUpdate}
            @durationchange=${this.handleVideoDurationChange}
            @loadedmetadata=${this.handleVideoLoadedMetadata}
            @volumechange=${this.handleVideoVolumeChange}
            @ratechange=${this.handleVideoRateChange}
            @ended=${this.handleVideoEnded}
          ></video>
          <savanna-sign-language
            exportparts="focus-ring"
            .src=${signLanguageSource}
            .interfaceLang=${this.lang}
            ?reduced-motion=${this.reducedMotion}
            ?open=${this.signLanguageOpen}
            @savanna-sign-language-close=${this.handleSignLanguageClose}
          ></savanna-sign-language>
        </div>
        <div
          class="controls-toolbar"
          part="toolbar"
          role="toolbar"
          aria-label=${this.text('mediaControls')}
        >
          ${
            this.status === 'ready' && this.resumeOffer !== null
              ? html`<button
                  type="button"
                  class="control-btn resume-btn"
                  part="focus-ring"
                  @click=${this.continueFromSaved}
                >
                  ${this.text('continueFrom', { time: formatTime(this.resumeOffer) })}
                </button>`
              : nothing
          }
          <button
            type="button"
            class="control-btn play-btn"
            part="focus-ring"
            @click=${this.togglePlay}
            aria-label=${this.isPaused ? this.text('play') : this.text('pause')}
          >
            <span aria-hidden="true">${this.isPaused ? '▶' : '⏸'}</span>
            <span class="visually-hidden"
              >${this.isPaused ? this.text('play') : this.text('pause')}</span
            >
          </button>

          <div class="seek-container">
            <label for="seek-control" class="visually-hidden">${this.text('seek')}</label>
            <input
              id="seek-control"
              type="range"
              class="control-range seek-range"
              part="focus-ring"
              min="0"
              max=${Number.isFinite(this.duration) && this.duration > 0 ? this.duration : 100}
              step="0.1"
              .value=${String(this.currentTime)}
              @input=${this.handleSeekInput}
              aria-label=${this.text('seek')}
              aria-valuetext=${this.text('seekValue', {
                current: formatTime(this.currentTime),
                duration: formatTime(this.duration),
              })}
            />
            <span class="time-display" aria-hidden="true">
              ${formatTime(this.currentTime)} / ${formatTime(this.duration)}
            </span>
          </div>

          <button
            type="button"
            class="control-btn mute-btn"
            part="focus-ring"
            @click=${this.toggleMute}
            aria-label=${this.isMuted ? this.text('unmute') : this.text('mute')}
          >
            <span aria-hidden="true">${this.isMuted ? '🔇' : '🔊'}</span>
            <span class="visually-hidden"
              >${this.isMuted ? this.text('unmute') : this.text('mute')}</span
            >
          </button>

          <div class="volume-container">
            <label for="volume-control" class="visually-hidden">${this.text('volume')}</label>
            <input
              id="volume-control"
              type="range"
              class="control-range volume-range"
              part="focus-ring"
              min="0"
              max="1"
              step="0.05"
              .value=${String(this.isMuted ? 0 : this.volume)}
              @input=${this.handleVolumeInput}
              aria-label=${this.text('volume')}
              aria-valuetext=${this.text('volumeValue', {
                percent: Math.round((this.isMuted ? 0 : this.volume) * 100),
              })}
            />
          </div>

          <button
            type="button"
            class="control-btn speed-btn"
            part="focus-ring"
            @click=${this.cyclePlaybackSpeed}
            aria-label=${this.text('playbackSpeed', { rate: this.playbackRate })}
          >
            <span aria-hidden="true">${this.playbackRate}x</span>
            <span class="visually-hidden"
              >${this.text('playbackSpeed', { rate: this.playbackRate })}</span
            >
          </button>

          <button
            type="button"
            class="control-btn copy-link-btn"
            part="focus-ring"
            @click=${() => void this.copyTimestampLink()}
          >
            ${this.text('copyLink', { time: formatTime(this.currentTime) })}
          </button>
          <span class="copy-status" role="status" aria-live="polite">${this.linkMessage}</span>

          <button
            type="button"
            class="control-btn fullscreen-btn"
            part="focus-ring"
            @click=${this.toggleFullscreen}
            aria-label=${this.isFullscreen ? this.text('exitFullscreen') : this.text('fullscreen')}
          >
            <span aria-hidden="true">${this.isFullscreen ? '⤓' : '⤢'}</span>
            <span class="visually-hidden"
              >${this.isFullscreen ? this.text('exitFullscreen') : this.text('fullscreen')}</span
            >
          </button>

          ${
            signLanguageSource
              ? html`<button
                  type="button"
                  class="control-btn sign-language-btn"
                  part="focus-ring"
                  @click=${this.toggleSignLanguage}
                  aria-label=${this.text('signLanguage')}
                  aria-pressed=${this.signLanguageOpen ? 'true' : 'false'}
                >
                  <span aria-hidden="true">🤟</span>
                  <span class="visually-hidden">${this.text('signLanguage')}</span>
                </button>`
              : nothing
          }
          ${
            audioDescriptionSource
              ? html`<button
                  type="button"
                  class="control-btn audio-description-btn"
                  part="focus-ring"
                  @click=${this.toggleAudioDescription}
                  aria-label=${this.text('audioDescription')}
                  aria-pressed=${this.audioDescriptionEnabled ? 'true' : 'false'}
                >
                  <span aria-hidden="true">AD</span>
                  <span class="visually-hidden">${this.text('audioDescription')}</span>
                </button>`
              : nothing
          }
          <button
            type="button"
            class="control-btn shortcut-help-btn"
            part="focus-ring"
            aria-expanded=${this.shortcutHelpOpen ? 'true' : 'false'}
            aria-controls="shortcut-help"
            @click=${this.toggleShortcutHelp}
          >
            ${this.text('shortcuts')}
          </button>
        </div>
        <div
          id="shortcut-help"
          class="shortcut-help"
          role="region"
          aria-label=${this.text('shortcuts')}
          ?hidden=${!this.shortcutHelpOpen}
        >
          <ul>
            <li>${this.text('helpSpace')}</li>
            <li>${this.text('helpEnter')}</li>
            <li>${this.text('helpSeek')}</li>
            <li>${this.text('helpVolume')}</li>
            <li>${this.text('helpMute')}</li>
            <li>${this.text('helpFullscreen')}</li>
            <li>${this.text('helpSign')}</li>
            <li>${this.text('helpRetry')}</li>
          </ul>
        </div>
        ${this.status === 'ready' ? this.renderReadingTools() : nothing} ${this.renderChapters()}
        ${
          this.status === 'ready'
            ? html`<savanna-transcript
                exportparts="focus-ring"
                .segments=${this.transcriptSegments}
                .currentTime=${this.currentTime}
                .language=${this.transcriptLanguage}
                .interfaceLang=${this.lang}
                ?reduced-motion=${this.reducedMotion}
                @savanna-transcript-seek=${this.onTranscriptSeek}
                @savanna-transcript-language=${this.onTranscriptLanguage}
                @savanna-transcript-bookmark=${this.onTranscriptBookmark}
              ></savanna-transcript>`
            : nothing
        }
        ${this.status === 'ready' ? this.renderBookmarks() : nothing}
        ${this.status === 'ready' && this.textLessonOpen ? this.renderTextLesson() : nothing}
        ${
          this.transcriptMessage === ''
            ? nothing
            : html`<p class="transcript-status" role="status">${this.transcriptMessage}</p>`
        }
>>>>>>> Stashed changes
        ${renderLessonDocuments(this.documentLinks, undefined, this.lang)}
        ${this.renderCaptionControls()} ${this.renderOfflineControls()}
      </section>
    `;
  }

  private onTranscriptSeek = (event: CustomEvent<TranscriptSeekDetail>): void => {
    const seconds = event.detail?.seconds;
    if (typeof seconds !== 'number') return;
    this.seekFromUser(seconds);
  };

  private seekFromUser(seconds: number): void {
    if (!Number.isFinite(seconds)) return;
    this.controller?.seekTo(seconds);
    this.noteUserSeek(seconds);
  }

  private renderReadingTools() {
    return html`
      <div class="reading-tools">
        <button
          type="button"
          class="control-btn download-transcript-btn"
          part="focus-ring"
          @click=${this.downloadTranscript}
        >
          ${this.text('downloadTranscript')}
        </button>
        <button
          type="button"
          class="control-btn text-lesson-btn"
          part="focus-ring"
          aria-expanded=${this.textLessonOpen ? 'true' : 'false'}
          aria-controls="text-lesson"
          @click=${this.toggleTextLesson}
        >
          ${this.text('textLesson')}
        </button>
        <span class="reading-status" role="status" aria-live="polite"
          >${this.noticeText(this.exportNotice)}</span
        >
      </div>
    `;
  }

  private renderChapters() {
    if (this.status !== 'ready') return nothing;
    const chapters = readableChapters(this.lesson?.chapters);
    if (chapters.length === 0) return nothing;
    return html`
      <nav class="chapters" aria-labelledby="chapters-heading">
        <h2 id="chapters-heading">${this.text('chapters')}</h2>
        <ol>
          ${chapters.map(
            (chapter) => html`
              <li>
                <button
                  type="button"
                  class="chapter-btn"
                  part="focus-ring"
                  @click=${() => this.seekFromUser(chapter.start)}
                >
                  <span class="chapter-name">${chapter.name}</span>
                  <span class="chapter-time">
                    <span class="visually-hidden">${this.text('startsAt')} </span
                    >${formatTime(chapter.start)}
                  </span>
                </button>
              </li>
            `,
          )}
        </ol>
      </nav>
    `;
  }

  private renderBookmarks() {
    const language = this.transcriptLanguage;
    return html`
      <section class="bookmarks" aria-labelledby="bookmarks-heading" lang=${language}>
        <h2 id="bookmarks-heading">${this.text('bookmarks')}</h2>
        ${
          this.bookmarks.length === 0
            ? html`<p class="bookmark-empty">${this.text('noBookmarks')}</p>`
            : html`
                <ul>
                  ${this.bookmarks.map(
                    (bookmark) => html`
                      <li class="bookmark-row">
                        <button
                          type="button"
                          class="bookmark-btn"
                          part="focus-ring"
                          @click=${() => this.seekFromUser(bookmark.start)}
                        >
                          <span class="sentence-time">
                            <span class="visually-hidden">${this.text('startsAt')} </span
                            >${formatTime(bookmark.start)}
                          </span>
                          <span>${bookmark.text}</span>
                        </button>
                        <button
                          type="button"
                          class="control-btn bookmark-remove"
                          part="focus-ring"
                          aria-label=${this.text('removeBookmark', {
                            time: formatTime(bookmark.start),
                            text: bookmark.text,
                          })}
                          @click=${() => this.deleteBookmark(bookmark.start)}
                        >
                          ${this.text('remove')}
                        </button>
                      </li>
                    `,
                  )}
                </ul>
              `
        }
        <span class="bookmark-status" role="status" aria-live="polite"
          >${this.noticeText(this.bookmarkNotice)}</span
        >
      </section>
    `;
  }

  private renderTextLesson() {
    const language = this.transcriptLanguage;
    const segments = this.transcriptSegments;
    return html`
      <section id="text-lesson" class="text-lesson" aria-labelledby="text-lesson-heading">
        <h2 id="text-lesson-heading">${this.text('textLesson')}</h2>
        <div class="text-lesson-transcript" lang=${language}>
          ${
            segments.length === 0
              ? html`<p class="text-lesson-empty">${this.text('textLessonEmpty')}</p>`
              : segments.map(
                  (segment) => html`
                    <div class="text-lesson-row">
                      <button
                        type="button"
                        class="text-lesson-sentence"
                        part="focus-ring"
                        @click=${() => this.seekFromUser(segment.start)}
                      >
                        <span class="sentence-time">
                          <span class="visually-hidden">${this.text('startsAt')} </span
                          >${formatTime(segment.start)}
                        </span>
                        <span>${segment.text}</span>
                      </button>
                      <button
                        type="button"
                        class="control-btn text-lesson-bookmark"
                        part="focus-ring"
                        lang=${language}
                        aria-label=${this.text('bookmarkSentence', { text: segment.text })}
                        @click=${() => this.saveSentenceBookmark(segment.start, segment.text)}
                      >
                        ${this.text('bookmark')}
                      </button>
                    </div>
                  `,
                )
          }
        </div>
        ${renderLessonDocuments(this.documentLinks, 'text-lesson-documents-heading', this.lang)}
      </section>
    `;
  }

  private noticeText(key: LabelKey | ''): string {
    return key === '' ? '' : this.text(key);
  }

  private toggleTextLesson = (): void => {
    this.textLessonOpen = !this.textLessonOpen;
  };

  private downloadTranscript = (): void => {
    const documentText = transcriptDocument(this.transcriptSegments);
    if (documentText === null) {
      this.exportNotice = 'transcriptEmpty';
      return;
    }
    const filename = transcriptFilename(this.lessonId, this.transcriptLanguage);
    let url: string | null = null;
    let anchor: HTMLAnchorElement | null = null;
    try {
      const blob = new Blob([documentText], { type: 'text/plain;charset=utf-8' });
      url = URL.createObjectURL(blob);
      anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.hidden = true;
      this.renderRoot.append(anchor);
      anchor.click();
      this.exportNotice = 'transcriptDownloaded';
    } catch {
      this.exportNotice = 'transcriptFailed';
    } finally {
      anchor?.remove();
      if (url !== null) URL.revokeObjectURL(url);
    }
  };

  private onTranscriptBookmark = (event: CustomEvent<TranscriptBookmarkDetail>): void => {
    const detail = event.detail;
    if (typeof detail?.start !== 'number' || typeof detail.text !== 'string') return;
    this.saveSentenceBookmark(detail.start, detail.text);
  };

  private saveSentenceBookmark(start: number, text: string): void {
    const result = addBookmark(this.lessonId, this.transcriptLanguage, { start, text });
    this.bookmarks = result.bookmarks;
    this.bookmarkNotice = bookmarkNoticeKey(result.status);
  }

  private deleteBookmark(start: number): void {
    const result = removeBookmark(this.lessonId, this.transcriptLanguage, start);
    this.bookmarks = result.bookmarks;
    this.bookmarkNotice = bookmarkNoticeKey(result.status);
  }

  private toggleShortcutHelp = (): void => {
    this.shortcutHelpOpen = !this.shortcutHelpOpen;
  };

  private onTranscriptLanguage = (event: CustomEvent<TranscriptLanguageDetail>): void => {
    const language = event.detail?.language;
    if (language !== 'en' && language !== 'am') return;
    if (language === this.transcriptLanguage) return;
    this.transcriptLanguage = language;
  };

  private renderCaptionControls() {
    const settings = this.captionSettings;
    const size = Math.round(settings.fontScale * 100);
    const textColor = captionColorInputValue(
      settings.textColor,
      DEFAULT_CAPTION_SETTINGS.textColor,
    );
    const backgroundColor = captionColorInputValue(
      settings.backgroundColor,
      CAPTION_BACKGROUND_SWATCH,
    );
    return html`
      <fieldset class="caption-settings">
        <legend>${this.text('captions')}</legend>
        <span class="caption-field">
          <label for="caption-enabled">${this.text('showCaptions')}</label>
          <input
            id="caption-enabled"
            part="focus-ring"
            type="checkbox"
            .checked=${settings.enabled}
            @change=${this.onCaptionsEnabled}
          />
        </span>
        <span class="caption-field">
          <label for="caption-language">${this.text('captionLanguage')}</label>
          <select
            id="caption-language"
            part="focus-ring"
            .value=${settings.language}
            @change=${this.onCaptionLanguage}
          >
            <option value="en" ?selected=${settings.language === 'en'}>
              ${this.text('english')}
            </option>
            <option value="am" lang="am" ?selected=${settings.language === 'am'}>
              ${this.text('amharic')}
            </option>
          </select>
        </span>
        <span class="caption-field">
          <label for="caption-size">${this.text('captionSize')}</label>
          <input
            id="caption-size"
            type="range"
            class="control-range caption-size"
            part="focus-ring"
            min=${MIN_CAPTION_FONT_SCALE}
            max=${MAX_CAPTION_FONT_SCALE}
            step="0.25"
            .value=${String(settings.fontScale)}
            aria-valuetext="${size}%"
            @input=${this.onCaptionSize}
          />
          <span class="caption-value" aria-hidden="true">${size}%</span>
        </span>
        <span class="caption-field">
          <label for="caption-text">${this.text('textColor')}</label>
          <input
            id="caption-text"
            class="caption-color"
            part="focus-ring"
            type="color"
            .value=${textColor}
            ?disabled=${settings.highContrast}
            @input=${this.onCaptionTextColor}
          />
        </span>
        <span class="caption-field">
          <label for="caption-background">${this.text('backgroundColor')}</label>
          <input
            id="caption-background"
            class="caption-color"
            part="focus-ring"
            type="color"
            .value=${backgroundColor}
            ?disabled=${settings.highContrast}
            @input=${this.onCaptionBackgroundColor}
          />
        </span>
        <span class="caption-field">
          <label for="caption-contrast">
            ${this.text('highContrast')}
            <span class="visually-hidden">${this.text('highContrastHint')}</span>
          </label>
          <input
            id="caption-contrast"
            part="focus-ring"
            type="checkbox"
            .checked=${settings.highContrast}
            @change=${this.onCaptionContrast}
          />
        </span>
      </fieldset>
    `;
  }

  private restorePlaybackPreferences(): void {
    if (this.playbackPreferencesLoaded) return;
    this.playbackPreferencesLoaded = true;
    const stored = readPlaybackSettings();
    if (stored === null) return;
    this.volume = stored.volume;
    this.playbackRate = stored.playbackRate;
    this.isMuted = stored.muted;
  }

  private syncPlaybackStart(): void {
    const video = this.videoElement;
    if (!video || this.status !== 'ready') return;
    if (video.readyState >= 1) this.consumeStartTime(video);
  }

  /** Apply saved speed and volume, then a timestamp link or the resume offer. */
  private consumeStartTime(video: HTMLVideoElement): void {
    const lessonId = this.lessonId.trim();
    if (lessonId === '' || this.status !== 'ready') return;
    const token = `${lessonId}:${this.requestId}`;
    if (this.playbackStartToken === token) return;
    this.playbackStartToken = token;

    this.applyStoredPlayback(video);
    const linked = readTimestamp(window.location.href, lessonId);
    if (linked !== null) {
      this.controller?.seekTo(linked);
      const actual = video.currentTime;
      this.currentTime = Number.isFinite(actual) ? actual : linked;
      this.resumeOffer = null;
      this.positionWrites = true;
      this.rememberPosition(this.currentTime, true);
    } else {
      const saved = readLessonPosition(lessonId);
      const duration = video.duration;
      const usable =
        saved !== null &&
        saved >= 1 &&
        (!Number.isFinite(duration) || duration <= 0 || saved < duration - 1);
      this.resumeOffer = usable ? saved : null;
      this.positionWrites = true;
    }
    this.notifyLessonReady(lessonId);
  }

  private applyStoredPlayback(video: HTMLVideoElement): void {
    this.applyingPlayback = true;
    video.volume = this.volume;
    video.muted = this.isMuted;
    video.playbackRate = this.playbackRate;
    if (Number.isFinite(video.volume)) this.volume = video.volume;
    if (Number.isFinite(video.playbackRate)) this.playbackRate = video.playbackRate;
    this.isMuted = video.muted;
    this.applyingPlayback = false;
    this.playbackApplied = true;
  }

  private noteUserSeek(target?: number): void {
    if (typeof target === 'number' && Number.isFinite(target)) {
      this.currentTime = target;
    } else if (this.videoElement && Number.isFinite(this.videoElement.currentTime)) {
      this.currentTime = this.videoElement.currentTime;
    }
    this.resumeOffer = null;
    this.rememberPosition(this.currentTime, true);
    this.emitProgress(true);
  }

  private continueFromSaved = (): void => {
    if (this.resumeOffer === null) return;
    const target = this.resumeOffer;
    this.controller?.seekTo(target);
    this.noteUserSeek(target);
  };

  private copyTimestampLink = async (): Promise<void> => {
    const lessonId = this.lessonId.trim();
    const seconds = this.videoElement?.currentTime ?? this.currentTime;
    const href = withTimestamp(window.location.href, lessonId, seconds);
    try {
      const clipboard = navigator.clipboard;
      if (typeof clipboard?.writeText !== 'function') throw new Error('clipboard unavailable');
      await clipboard.writeText(href);
      this.linkState = 'copied';
      this.linkMessage = this.text('linkCopied');
    } catch {
      this.linkState = 'failed';
      this.linkMessage = this.text('linkCopyFailed');
    }
  };

  private rememberPosition(seconds: number, force: boolean): void {
    const lessonId = this.lessonId.trim();
    if (!this.positionWrites || this.status !== 'ready' || lessonId === '') return;
    if (!Number.isFinite(seconds) || seconds < 0) return;
    const mark = Math.floor(seconds);
    if (!force && mark === this.lastSavedPositionSecond) return;
    this.lastSavedPositionSecond = mark;
    this.positionTouched = true;
    saveLessonPosition(lessonId, seconds);
  }

  private rememberPlayback(): void {
    if (!Number.isFinite(this.volume) || !Number.isFinite(this.playbackRate)) return;
    savePlaybackSettings({
      volume: this.volume,
      playbackRate: this.playbackRate,
      muted: this.isMuted,
    });
  }

  private emitProgress(force: boolean): void {
    const lessonId = this.lessonId.trim();
    if (!this.positionWrites || this.status !== 'ready' || lessonId === '') return;
    const second = Math.floor(this.currentTime);
    if (!force && second === this.lastProgressSecond) return;
    this.lastProgressSecond = second;
    this.emitPlayback('savanna-progress', lessonId, this.currentTime);
  }

  private notifyLessonReady(lessonId: string): void {
    const token = `${lessonId}:${this.requestId}`;
    if (this.readyNotifiedFor === token) return;
    this.readyNotifiedFor = token;
    this.emitPlayback('savanna-lesson-ready', lessonId, this.currentTime);
  }

  private emitPlayback(
    name: 'savanna-lesson-ready' | 'savanna-progress' | 'savanna-completed',
    lessonId: string,
    currentTime: number,
  ): void {
    this.dispatchEvent(
      new CustomEvent(name, {
        detail: { lessonId, currentTime },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private restoreCaptionSettings(changed: PropertyValues<this>): void {
    if (!this.captionPreferencesLoaded) {
      this.captionPreferencesLoaded = true;
      const stored = readStoredCaptionSettings();
      this.captionChoiceStored = stored !== null;
      const defaults = {
        ...DEFAULT_CAPTION_SETTINGS,
        language: this.captionLanguage || DEFAULT_CAPTION_SETTINGS.language,
        highContrast: stored === null && mediaMatches(FORCED_COLORS_QUERY),
      };
      this.captionSettings = sanitizeCaptionSettings(stored ?? defaults);
      return;
    }
    if (!this.captionChoiceStored && changed.has('captionLanguage')) {
      this.captionSettings = sanitizeCaptionSettings({
        ...this.captionSettings,
        language: this.captionLanguage || DEFAULT_CAPTION_SETTINGS.language,
      });
    }
  }

  private syncCaptions(changed: PropertyValues<this>): void {
    const video = this.videoElement;
    if (!video) return;
    let manager = this.captionManager;
    const created = manager === null || !manager.manages(video);
    if (manager === null || !manager.manages(video)) {
      manager = new CaptionManager(video);
      this.captionManager = manager;
    }
    if (created || changed.has('lesson')) manager.loadTracks(this.lesson?.captions ?? []);
    if (created || changed.has('lesson') || changed.has('captionSettings')) {
      manager.apply(this.captionSettings);
    }
  }

  private commitCaptionSettings(patch: Partial<CaptionSettings>): void {
    this.captionChoiceStored = true;
    this.captionSettings = sanitizeCaptionSettings({ ...this.captionSettings, ...patch });
    saveCaptionSettings(this.captionSettings);
  }

  private readonly onCaptionsEnabled = (event: Event): void => {
    this.commitCaptionSettings({ enabled: (event.target as HTMLInputElement).checked });
  };

  private readonly onCaptionLanguage = (event: Event): void => {
    this.commitCaptionSettings({ language: (event.target as HTMLSelectElement).value });
  };

  private readonly onCaptionSize = (event: Event): void => {
    const fontScale = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(fontScale)) return;
    this.commitCaptionSettings({ fontScale });
  };

  private readonly onCaptionTextColor = (event: Event): void => {
    this.commitCaptionSettings({ textColor: (event.target as HTMLInputElement).value });
  };

  private readonly onCaptionBackgroundColor = (event: Event): void => {
    this.commitCaptionSettings({ backgroundColor: (event.target as HTMLInputElement).value });
  };

  private readonly onCaptionContrast = (event: Event): void => {
    this.commitCaptionSettings({ highContrast: (event.target as HTMLInputElement).checked });
  };

  private beginLoad(): void {
    this.resumeOffer = null;
    this.positionWrites = false;
    this.positionTouched = false;
    this.lastSavedPositionSecond = -1;
    this.lastProgressSecond = -1;
    this.playbackStartToken = '';
    this.readyNotifiedFor = '';
    this.abortController?.abort();
    this.abortController = null;
    this.transcriptRequestId += 1;
    this.transcriptSegments = [];
    this.transcriptLanguage = transcriptLanguageOf(this.captionLanguage);
    this.bookmarkNotice = '';
    this.exportNotice = '';
    this.textLessonOpen = false;
    this.transcriptMessage = '';
    this.offlineItem = null;
    this.failedDownloadMode = null;
    this.offlineStatus = 'not-downloaded';
    this.offlineNotice = { kind: 'idle' };
    this.offlineMessage = '';

    const lessonId = this.lessonId.trim();
    const apiBase = this.apiBase.trim();
    if (lessonId === '' || apiBase === '') {
      this.requestId += 1;
      this.setOutcome('idle', '', null);
      return;
    }

    const controller = new AbortController();
    this.abortController = controller;
    const requestId = ++this.requestId;
    this.setOutcome('loading', this.text('loadingLesson', { id: lessonId }), null);
    void this.finishLoad(new LessonClient(apiBase), lessonId, controller, requestId);
  }

  private async finishLoad(
    client: LessonClient,
    lessonId: string,
    controller: AbortController,
    requestId: number,
  ): Promise<void> {
    try {
      const lesson = await client.getLesson(lessonId, controller.signal);
      if (!this.isCurrent(requestId, controller)) return;
      const outcome = describeLesson(lesson, this.lang);
      this.setOutcome(outcome.status, outcome.message, lesson);
      if (outcome.status === 'ready') void this.refreshOfflineStatus();
    } catch (error: unknown) {
      if (!this.isCurrent(requestId, controller) || isAbortError(error)) return;
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : LESSON_LOAD_FAILURE_MESSAGE;
      this.setOutcome('error', message, null);
      this.dispatchEvent(
        new CustomEvent('savanna-error', {
          detail: { message, cause: error },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private setOutcome(status: PlayerStatus, message: string, lesson: Lesson | null): void {
    const statusChanged = this.status !== status;
    this.lesson = lesson;
    this.videoSrc = lesson?.media?.video ?? '';
    this.signLanguageSrc = lesson?.media?.signLanguage ?? '';
    this.statusMessage = message;
    this.status = status;
    if (statusChanged) {
      this.dispatchEvent(
        new CustomEvent('savanna-status-change', {
          detail: { status },
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }
    this.syncAnnouncement();
  }

  private syncAnnouncement(): void {
    const statusRegion = this.renderRoot.querySelector<HTMLElement>('#player-status');
    const errorRegion = this.renderRoot.querySelector<HTMLElement>('#player-error');
    if (statusRegion === null || errorRegion === null) return;
    this.statusAnnouncer ??= new Announcer(statusRegion);
    this.errorAnnouncer ??= new Announcer(errorRegion);
    if (this.status === 'error') {
      this.errorAnnouncer.announce(this.statusMessage);
      this.statusAnnouncer.announce('');
      return;
    }
    this.statusAnnouncer.announce(this.statusMessage);
    this.errorAnnouncer.announce('');
  }

  private isCurrent(requestId: number, controller: AbortController): boolean {
    return this.isConnected && this.requestId === requestId && !controller.signal.aborted;
  }

  private async loadTranscript(): Promise<void> {
    const language = this.transcriptLanguage;
    const lessonId = this.lessonId.trim();
    const apiBase = this.apiBase.trim();
    if (this.status !== 'ready' || lessonId === '' || apiBase === '') return;

    const requestId = ++this.transcriptRequestId;
    try {
      const transcript = await new LessonClient(apiBase).getTranscript(lessonId, language);
      if (!this.isTranscriptCurrent(requestId, language)) return;
      this.transcriptSegments = Array.isArray(transcript.segments) ? transcript.segments : [];
      this.transcriptMessage = '';
    } catch {
      if (!this.isTranscriptCurrent(requestId, language)) return;
      this.transcriptSegments = [];
      this.transcriptMessage = this.text('transcriptFailed');
    }
  }

  private isTranscriptCurrent(requestId: number, language: 'en' | 'am'): boolean {
    return (
      this.isConnected &&
      this.status === 'ready' &&
      requestId === this.transcriptRequestId &&
      language === this.transcriptLanguage
    );
  }
}

function transcriptLanguageOf(value: string): 'en' | 'am' {
  return value === 'am' ? 'am' : 'en';
}

function describeLesson(
  lesson: Lesson,
  lang: string,
): { status: 'ready' | 'empty'; message: string } {
  const video = lesson.media?.video;
  if (typeof video !== 'string' || video.trim() === '') {
    return { status: 'empty', message: interfaceText(lang, 'emptyLesson') };
  }
  const title = lesson.title.trim();
  return {
    status: 'ready',
    message:
      title === ''
        ? interfaceText(lang, 'lessonReady')
        : interfaceText(lang, 'lessonReadyNamed', { title }),
  };
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  );
}

if (!customElements.get(PLAYER_TAG)) {
  customElements.define(PLAYER_TAG, SavannaPlayer);
}

declare global {
  interface HTMLElementTagNameMap {
    'savanna-player': SavannaPlayer;
  }
}
