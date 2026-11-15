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
  EMPTY_LESSON_MESSAGE,
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
import { SIGN_LANGUAGE_TAG, type SignLanguageWindow } from '../sign-language/sign-language-window';
import '../transcript/transcript-panel';
import type {
  TranscriptLanguageDetail,
  TranscriptSeekDetail,
} from '../transcript/transcript-panel';

const DOWNLOAD_FAILURE_MESSAGE = 'The download failed. Check your connection and try again.';
const NO_WORKER_MESSAGE =
  'Downloaded, but this site has not set up offline playback, so the lesson may not open offline.';
const OFFLINE_MODES: { mode: OfflineMode; label: string }[] = [
  { mode: 'audio', label: 'Download audio only' },
  { mode: 'text', label: 'Download text only' },
  { mode: 'full', label: 'Download everything' },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
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
    transcriptLanguage: { state: true },
    transcriptSegments: { state: true },
    captionSettings: { state: true },
    signLanguageOpen: { state: true },
    signLanguageSrc: { state: true },
    audioDescriptionEnabled: { state: true },
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

    .time-display {
      font-size: 0.875rem;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
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

    .offline-status {
      margin: 0;
      flex-basis: 100%;
      font-size: 0.875rem;
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

    ${lessonDocumentStyles}
  `;

  declare lessonId: string;
  declare apiBase: string;
  declare captionLanguage: string;
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

  /** Offline download manager; created on first use, or supplied by a host or a test. */
  offlineManager: DownloadManager | undefined;
  declare transcriptLanguage: 'en' | 'am';
  declare transcriptSegments: TranscriptSegment[];
  declare captionSettings: CaptionSettings;
  declare signLanguageOpen: boolean;
  declare signLanguageSrc: string;
  declare audioDescriptionEnabled: boolean;

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
  private mediaSync: MediaSync | null = null;
  private signLanguageDetach: (() => void) | null = null;
  private audioDescription: AudioDescriptionTrack | null = null;
  private documentLinks: LessonDocumentLink[] = [];

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const action = resolveShortcut(event, this);
    if (!action) return;
    switch (action) {
      case 'toggle-play':
        void this.togglePlay();
        break;
      case 'seek-backward':
        this.controller?.seekBy(-SEEK_STEP_SECONDS);
        break;
      case 'seek-forward':
        this.controller?.seekBy(SEEK_STEP_SECONDS);
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
    this.transcriptLanguage = 'en';
    this.transcriptSegments = [];
    this.captionSettings = { ...DEFAULT_CAPTION_SETTINGS };
    this.signLanguageOpen = false;
    this.signLanguageSrc = '';
    this.audioDescriptionEnabled = false;
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
    this.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
    if (this.connectedOnce) this.beginLoad();
    this.connectedOnce = true;
  }

  override disconnectedCallback(): void {
    this.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    this.releaseAudioDescription();
    this.signLanguageDetach?.();
    this.signLanguageDetach = null;
    this.mediaSync?.dispose();
    this.mediaSync = null;
    this.abortController?.abort();
    this.abortController = null;
    this.transcriptRequestId += 1;
    super.disconnectedCallback();
  }

  private handleFullscreenChange = (): void => {
    this.isFullscreen = Boolean(document.fullscreenElement);
  };

  override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('captionLanguage')) {
      this.transcriptLanguage = transcriptLanguageOf(this.captionLanguage);
    }
    this.restoreCaptionSettings(changed);
    if (changed.has('lesson')) {
      this.signLanguageSrc = this.lesson?.media?.signLanguage ?? this.signLanguageSrc;
      this.documentLinks = lessonDocumentLinks(this.lesson?.documents, document.baseURI);
    }
    if (changed.has('lessonId') || changed.has('apiBase')) this.beginLoad();
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
    }
  };

  handleSeekInput = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    const value = parseFloat(target.value);
    this.controller?.seekTo(value);
    this.currentTime = value;
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
    }
  };

  cyclePlaybackSpeed = (): void => {
    const speeds: readonly number[] = PLAYBACK_RATES;
    const currentIndex = speeds.indexOf(this.playbackRate);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length] ?? 1;
    this.controller?.setPlaybackRate(nextSpeed);
    this.playbackRate = nextSpeed;
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
    this.offlineMessage = 'Downloading.';
    try {
      const pkg = await new LessonClient(this.apiBase.trim()).getOfflinePackage(
        this.lessonId.trim(),
      );
      await this.manager.download(pkg, mode, (progress) => {
        if (progress.status === 'downloading') {
          this.offlineMessage = `Downloading. ${formatBytes(progress.completedBytes)} saved.`;
        }
      });
      const label = OFFLINE_MODES.find((entry) => entry.mode === mode)?.label ?? mode;
      const playbackReady = await this.registerWorker();
      this.offlineStatus = 'downloaded';
      this.offlineMessage = playbackReady
        ? `Downloaded for offline use: ${label.replace('Download ', '')}.`
        : NO_WORKER_MESSAGE;
    } catch {
      this.offlineStatus = 'failed';
      this.offlineMessage = DOWNLOAD_FAILURE_MESSAGE;
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
    this.offlineStatus = 'not-downloaded';
    this.offlineMessage = 'Offline copy removed.';
  };

  private async refreshOfflineStatus(): Promise<void> {
    if (!this.supportsOffline) return;
    try {
      const status = await this.manager.status(this.lessonId.trim());
      if (status === 'downloaded') {
        this.offlineStatus = 'downloaded';
        this.offlineMessage = 'This lesson is available offline.';
      }
    } catch {
      // Offline storage is optional; ignore failures and keep the download buttons.
    }
  }

  private renderOfflineControls() {
    if (this.status !== 'ready' || !this.supportsOffline) return nothing;
    const busy = this.offlineStatus === 'downloading';
    return html`
      <div class="offline" role="group" aria-label="Offline use">
        ${OFFLINE_MODES.map(
          ({ mode, label }) => html`
            <button
              type="button"
              class="control-btn offline-btn"
              data-mode=${mode}
              aria-disabled=${busy ? 'true' : 'false'}
              @click=${() => void this.downloadLesson(mode)}
            >
              ${label}
            </button>
          `,
        )}
        ${
          this.offlineStatus === 'downloaded'
            ? html`<button
                type="button"
                class="control-btn offline-remove"
                @click=${() => void this.removeDownload()}
              >
                Remove download
              </button>`
            : nothing
        }
        <p id="offline-status" class="offline-status" role="status" aria-live="polite">
          ${this.offlineMessage}
        </p>
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
    if (this.videoElement) {
      this.currentTime = this.videoElement.currentTime;
    }
  };

  private handleVideoDurationChange = (): void => {
    if (this.videoElement) {
      this.duration = this.videoElement.duration;
    }
  };

  private handleVideoVolumeChange = (): void => {
    if (this.videoElement) {
      this.volume = this.videoElement.volume;
      this.isMuted = this.videoElement.muted;
    }
  };

  private handleVideoRateChange = (): void => {
    if (this.videoElement) {
      this.playbackRate = this.videoElement.playbackRate;
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
        aria-label="Lesson player"
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
        <div class="video-wrapper">
          <video
            class="lesson-video"
            src=${videoSource}
            playsinline
            crossorigin="anonymous"
            aria-label=${this.lesson?.title || 'Lesson video'}
            @play=${this.handleVideoPlay}
            @pause=${this.handleVideoPause}
            @timeupdate=${this.handleVideoTimeUpdate}
            @durationchange=${this.handleVideoDurationChange}
            @volumechange=${this.handleVideoVolumeChange}
            @ratechange=${this.handleVideoRateChange}
            @ended=${this.handleVideoPause}
          ></video>
          <savanna-sign-language
            .src=${signLanguageSource}
            ?open=${this.signLanguageOpen}
            @savanna-sign-language-close=${this.handleSignLanguageClose}
          ></savanna-sign-language>
        </div>
        <div class="controls-toolbar" role="toolbar" aria-label="Media player controls">
          <button
            type="button"
            class="control-btn play-btn"
            @click=${this.togglePlay}
            aria-label=${this.isPaused ? 'Play' : 'Pause'}
          >
            <span aria-hidden="true">${this.isPaused ? '▶' : '⏸'}</span>
            <span class="visually-hidden">${this.isPaused ? 'Play' : 'Pause'}</span>
          </button>

          <div class="seek-container">
            <label for="seek-control" class="visually-hidden">Seek</label>
            <input
              id="seek-control"
              type="range"
              class="control-range seek-range"
              min="0"
              max=${Number.isFinite(this.duration) && this.duration > 0 ? this.duration : 100}
              step="0.1"
              .value=${String(this.currentTime)}
              @input=${this.handleSeekInput}
              aria-label="Seek"
              aria-valuetext="${formatTime(this.currentTime)} of ${formatTime(this.duration)}"
            />
            <span class="time-display" aria-hidden="true">
              ${formatTime(this.currentTime)} / ${formatTime(this.duration)}
            </span>
          </div>

          <button
            type="button"
            class="control-btn mute-btn"
            @click=${this.toggleMute}
            aria-label=${this.isMuted ? 'Unmute' : 'Mute'}
          >
            <span aria-hidden="true">${this.isMuted ? '🔇' : '🔊'}</span>
            <span class="visually-hidden">${this.isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <div class="volume-container">
            <label for="volume-control" class="visually-hidden">Volume</label>
            <input
              id="volume-control"
              type="range"
              class="control-range volume-range"
              min="0"
              max="1"
              step="0.05"
              .value=${String(this.isMuted ? 0 : this.volume)}
              @input=${this.handleVolumeInput}
              aria-label="Volume"
              aria-valuetext="${Math.round((this.isMuted ? 0 : this.volume) * 100)}%"
            />
          </div>

          <button
            type="button"
            class="control-btn speed-btn"
            @click=${this.cyclePlaybackSpeed}
            aria-label="Playback speed: ${this.playbackRate}x"
          >
            <span aria-hidden="true">${this.playbackRate}x</span>
            <span class="visually-hidden">Playback speed: ${this.playbackRate}x</span>
          </button>

          <button
            type="button"
            class="control-btn fullscreen-btn"
            @click=${this.toggleFullscreen}
            aria-label=${this.isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            <span aria-hidden="true">${this.isFullscreen ? '⤓' : '⤢'}</span>
            <span class="visually-hidden"
              >${this.isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</span
            >
          </button>

          ${
            signLanguageSource
              ? html`<button
                  type="button"
                  class="control-btn sign-language-btn"
                  @click=${this.toggleSignLanguage}
                  aria-label="Ethiopian Sign Language"
                  aria-pressed=${this.signLanguageOpen ? 'true' : 'false'}
                >
                  <span aria-hidden="true">🤟</span>
                  <span class="visually-hidden">Ethiopian Sign Language</span>
                </button>`
              : nothing
          }
          ${
            audioDescriptionSource
              ? html`<button
                  type="button"
                  class="control-btn audio-description-btn"
                  @click=${this.toggleAudioDescription}
                  aria-label="Audio description"
                  aria-pressed=${this.audioDescriptionEnabled ? 'true' : 'false'}
                >
                  <span aria-hidden="true">AD</span>
                  <span class="visually-hidden">Audio description</span>
                </button>`
              : nothing
          }
        </div>
        ${
          this.status === 'ready'
            ? html`<savanna-transcript
                .segments=${this.transcriptSegments}
                .currentTime=${this.currentTime}
                .language=${this.transcriptLanguage}
                @savanna-transcript-seek=${this.onTranscriptSeek}
                @savanna-transcript-language=${this.onTranscriptLanguage}
              ></savanna-transcript>`
            : nothing
        }
        ${renderLessonDocuments(this.documentLinks)} ${this.renderCaptionControls()}
        ${this.renderOfflineControls()}
      </section>
    `;
  }

  private onTranscriptSeek = (event: CustomEvent<TranscriptSeekDetail>): void => {
    const seconds = event.detail?.seconds;
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return;
    this.controller?.seekTo(seconds);
    this.currentTime = this.videoElement?.currentTime ?? seconds;
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
        <legend>Captions</legend>
        <span class="caption-field">
          <label for="caption-enabled">Show captions</label>
          <input
            id="caption-enabled"
            type="checkbox"
            .checked=${settings.enabled}
            @change=${this.onCaptionsEnabled}
          />
        </span>
        <span class="caption-field">
          <label for="caption-language">Language</label>
          <select
            id="caption-language"
            .value=${settings.language}
            @change=${this.onCaptionLanguage}
          >
            <option value="en" ?selected=${settings.language === 'en'}>English</option>
            <option value="am" lang="am" ?selected=${settings.language === 'am'}>
              Amharic (አማርኛ)
            </option>
          </select>
        </span>
        <span class="caption-field">
          <label for="caption-size">Caption size</label>
          <input
            id="caption-size"
            type="range"
            class="control-range caption-size"
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
          <label for="caption-text">Text color</label>
          <input
            id="caption-text"
            class="caption-color"
            type="color"
            .value=${textColor}
            ?disabled=${settings.highContrast}
            @input=${this.onCaptionTextColor}
          />
        </span>
        <span class="caption-field">
          <label for="caption-background">Background color</label>
          <input
            id="caption-background"
            class="caption-color"
            type="color"
            .value=${backgroundColor}
            ?disabled=${settings.highContrast}
            @input=${this.onCaptionBackgroundColor}
          />
        </span>
        <span class="caption-field">
          <label for="caption-contrast">
            High contrast
            <span class="visually-hidden">Black text on a yellow background</span>
          </label>
          <input
            id="caption-contrast"
            type="checkbox"
            .checked=${settings.highContrast}
            @change=${this.onCaptionContrast}
          />
        </span>
      </fieldset>
    `;
  }

  private restoreCaptionSettings(changed: PropertyValues<this>): void {
    if (!this.captionPreferencesLoaded) {
      this.captionPreferencesLoaded = true;
      const stored = readStoredCaptionSettings();
      this.captionChoiceStored = stored !== null;
      this.captionSettings = sanitizeCaptionSettings(
        stored ?? {
          ...DEFAULT_CAPTION_SETTINGS,
          language: this.captionLanguage || DEFAULT_CAPTION_SETTINGS.language,
        },
      );
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
    this.abortController?.abort();
    this.abortController = null;
    this.transcriptRequestId += 1;
    this.transcriptSegments = [];
    this.transcriptLanguage = transcriptLanguageOf(this.captionLanguage);

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
    this.setOutcome('loading', `Loading lesson ${lessonId}.`, null);
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
      const outcome = describeLesson(lesson);
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
    } catch {
      if (!this.isTranscriptCurrent(requestId, language)) return;
      this.transcriptSegments = [];
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

function describeLesson(lesson: Lesson): { status: 'ready' | 'empty'; message: string } {
  const video = lesson.media?.video;
  if (typeof video !== 'string' || video.trim() === '') {
    return { status: 'empty', message: EMPTY_LESSON_MESSAGE };
  }
  const title = lesson.title.trim();
  return { status: 'ready', message: title === '' ? 'Lesson ready.' : `Lesson ready: ${title}.` };
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
