/** Wraps the main HTML5 <video> and is the single source of truth for playback state. */
export class MediaController {
  constructor(protected readonly video: HTMLVideoElement) {}

  async togglePlay(): Promise<void> {
    if (this.video.paused || this.video.ended) {
      const res = this.video.play();
      if (res && typeof res.then === 'function') {
        await res;
      }
    } else {
      this.video.pause();
    }
  }

  seekBy(seconds: number): void {
    const duration = Number.isFinite(this.video.duration) ? this.video.duration : Infinity;
    const current = Number.isFinite(this.video.currentTime) ? this.video.currentTime : 0;
    const target = current + seconds;
    this.video.currentTime = Math.max(0, Math.min(duration, target));
  }

  seekTo(seconds: number): void {
    const duration = Number.isFinite(this.video.duration) ? this.video.duration : Infinity;
    this.video.currentTime = Math.max(0, Math.min(duration, Math.max(0, seconds)));
  }

  changeVolume(delta: number): void {
    const current = Number.isFinite(this.video.volume) ? this.video.volume : 1;
    const next = Math.max(0, Math.min(1, current + delta));
    this.video.volume = next;
    if (next > 0 && this.video.muted) {
      this.video.muted = false;
    }
  }

  toggleMute(): void {
    this.video.muted = !this.video.muted;
  }

  setPlaybackRate(rate: number): void {
    if (rate > 0) {
      this.video.playbackRate = rate;
    }
  }

  async toggleFullscreen(container: HTMLElement): Promise<void> {
    const doc = container.ownerDocument ?? document;
    if (doc.fullscreenElement) {
      if (typeof doc.exitFullscreen === 'function') {
        await doc.exitFullscreen();
      }
    } else {
      if (typeof container.requestFullscreen === 'function') {
        await container.requestFullscreen();
      }
    }
  }

  get isPaused(): boolean {
    return this.video.paused;
  }

  get isMuted(): boolean {
    return this.video.muted;
  }

  get volume(): number {
    return this.video.volume;
  }

  get currentTime(): number {
    return this.video.currentTime;
  }

  get duration(): number {
    return this.video.duration;
  }

  get playbackRate(): number {
    return this.video.playbackRate;
  }
}
