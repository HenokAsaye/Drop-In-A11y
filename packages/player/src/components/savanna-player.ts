import { PLAYER_TAG, type Lesson, type PlayerStatus } from '@savanna/contracts';
import { LitElement, css, html, type PropertyValues } from 'lit';

import { LessonClient } from '../api/lesson-client';
import { MediaController } from '../media/media-controller';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * <savanna-player lesson-id="..." api-base="..."> — the single entry point host websites embed.
 * Composes the media, captions, transcript, sign-language, audio-description and offline features.
 */
export class SavannaPlayer extends LitElement {
  static override properties = {
    lessonId: { type: String, attribute: 'lesson-id', reflect: true },
    apiBase: { type: String, attribute: 'api-base', reflect: true },
    captionLanguage: { type: String, attribute: 'caption-language' },
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
    errorMessage: { state: true },
  };

  static override styles = css`
    :host {
      display: block;
      font: inherit;
      color: inherit;
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

    .status-message {
      padding: 0.75rem 1rem;
      text-align: center;
      background: #1e293b;
      color: #f8fafc;
      margin: 0;
      font-size: 0.875rem;
    }

    .error-message {
      background: #7f1d1d;
      color: #fef2f2;
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

    button:focus-visible,
    input[type='range']:focus-visible {
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
      height: 6px;
      cursor: pointer;
      accent-color: #38bdf8;
    }

    .volume-container {
      display: flex;
      align-items: center;
      width: 80px;
    }

    .time-display {
      font-size: 0.875rem;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
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
  `;

  declare lessonId: string;
  declare apiBase: string;
  declare captionLanguage: string;
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
  declare errorMessage: string;

  private abortController: AbortController | null = null;
  private _controller: MediaController | null = null;

  constructor() {
    super();
    this.lessonId = '';
    this.apiBase = '';
    this.captionLanguage = 'en';
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
    this.errorMessage = '';
  }

  get videoElement(): HTMLVideoElement | null {
    return this.renderRoot?.querySelector('video') ?? null;
  }

  get controller(): MediaController | null {
    const video = this.videoElement;
    if (video && (!this._controller || this._controller['video'] !== video)) {
      this._controller = new MediaController(video);
    }
    return this._controller;
  }

  override connectedCallback() {
    super.connectedCallback();
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private handleFullscreenChange = () => {
    this.isFullscreen = Boolean(document.fullscreenElement);
  };

  async loadLesson(): Promise<void> {
    if (!this.lessonId || !this.apiBase) {
      return;
    }

    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.status = 'loading';
    this.dispatchEvent(new CustomEvent('savanna-status-change', { detail: { status: 'loading' } }));

    try {
      const client = new LessonClient(this.apiBase);
      const lesson = await client.getLesson(this.lessonId, signal);
      if (signal.aborted) return;

      this.lesson = lesson;
      const videoSrc = lesson.media?.video;
      if (!videoSrc) {
        this.status = 'empty';
        this.dispatchEvent(
          new CustomEvent('savanna-status-change', { detail: { status: 'empty' } }),
        );
        return;
      }

      this.videoSrc = videoSrc;
      this.status = 'ready';
      this.dispatchEvent(new CustomEvent('savanna-status-change', { detail: { status: 'ready' } }));
    } catch (err: unknown) {
      if (signal.aborted) return;
      if (err instanceof Error && err.name === 'AbortError') return;
      this.status = 'error';
      const message = err instanceof Error ? err.message : String(err);
      this.errorMessage = message;
      this.dispatchEvent(new CustomEvent('savanna-status-change', { detail: { status: 'error' } }));
      this.dispatchEvent(new CustomEvent('savanna-error', { detail: { message, cause: err } }));
    }
  }

  override updated(changedProperties: PropertyValues<this>) {
    super.updated(changedProperties);
    if (changedProperties.has('lessonId') || changedProperties.has('apiBase')) {
      if (this.lessonId && this.apiBase) {
        queueMicrotask(() => {
          void this.loadLesson();
        });
      }
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
    const speeds = [0.75, 1, 1.25, 1.5, 2];
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

  private handleVideoPlay = () => {
    this.isPaused = false;
  };

  private handleVideoPause = () => {
    this.isPaused = true;
  };

  private handleVideoTimeUpdate = () => {
    if (this.videoElement) {
      this.currentTime = this.videoElement.currentTime;
    }
  };

  private handleVideoDurationChange = () => {
    if (this.videoElement) {
      this.duration = this.videoElement.duration;
    }
  };

  private handleVideoVolumeChange = () => {
    if (this.videoElement) {
      this.volume = this.videoElement.volume;
      this.isMuted = this.videoElement.muted;
    }
  };

  private handleVideoRateChange = () => {
    if (this.videoElement) {
      this.playbackRate = this.videoElement.playbackRate;
    }
  };

  private renderStatus() {
    if (this.status === 'loading') {
      return html`<p class="status-message" role="status" aria-live="polite">Loading lesson...</p>`;
    }
    if (this.status === 'error') {
      return html`<p class="status-message error-message" role="alert">
        ${this.errorMessage || 'Failed to load lesson'}
      </p>`;
    }
    if (this.status === 'empty') {
      return html`<p class="status-message" role="status">No media available</p>`;
    }
    return null;
  }

  override render() {
    return html`
      <section class="player-container" aria-label="Lesson player">
        ${this.renderStatus()}
        <div class="video-wrapper">
          <video
            src=${this.videoSrc || ''}
            playsinline
            aria-label=${this.lesson?.title || 'Lesson video'}
            @play=${this.handleVideoPlay}
            @pause=${this.handleVideoPause}
            @timeupdate=${this.handleVideoTimeUpdate}
            @durationchange=${this.handleVideoDurationChange}
            @volumechange=${this.handleVideoVolumeChange}
            @ratechange=${this.handleVideoRateChange}
            @ended=${this.handleVideoPause}
          ></video>
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
            aria-label="Playback speed"
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
        </div>
      </section>
    `;
  }
}

if (!customElements.get(PLAYER_TAG)) {
  customElements.define(PLAYER_TAG, SavannaPlayer);
}

declare global {
  interface HTMLElementTagNameMap {
    'savanna-player': SavannaPlayer;
  }
}
