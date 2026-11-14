export const DEFAULT_DRIFT_TOLERANCE_SECONDS = 0.3;

/**
 * Keeps secondary media (sign-language video, audio description) following the main video
 * on play, pause, seek and playback-rate changes.
 */
export class MediaSync {
  private readonly unbinds = new Map<HTMLMediaElement, () => void>();

  constructor(
    protected readonly primary: HTMLMediaElement,
    protected readonly tolerance: number = DEFAULT_DRIFT_TOLERANCE_SECONDS,
  ) {}

  attach(secondary: HTMLMediaElement): () => void {
    this.detach(secondary);

    // Align initial playback state
    secondary.playbackRate = this.primary.playbackRate;
    secondary.currentTime = this.primary.currentTime;
    if (!this.primary.paused && !this.primary.ended) {
      void secondary.play().catch(() => {});
    } else {
      secondary.pause();
    }

    const onPlay = (): void => {
      const drift = Math.abs(secondary.currentTime - this.primary.currentTime);
      if (drift > this.tolerance) {
        secondary.currentTime = this.primary.currentTime;
      }
      secondary.playbackRate = this.primary.playbackRate;
      void secondary.play().catch(() => {});
    };

    const onPause = (): void => {
      secondary.pause();
      const drift = Math.abs(secondary.currentTime - this.primary.currentTime);
      if (drift > this.tolerance) {
        secondary.currentTime = this.primary.currentTime;
      }
    };

    const onSeeked = (): void => {
      secondary.currentTime = this.primary.currentTime;
    };

    const onSeeking = (): void => {
      secondary.currentTime = this.primary.currentTime;
    };

    const onRateChange = (): void => {
      secondary.playbackRate = this.primary.playbackRate;
    };

    const onTimeUpdate = (): void => {
      const drift = Math.abs(this.primary.currentTime - secondary.currentTime);
      if (drift > this.tolerance) {
        secondary.currentTime = this.primary.currentTime;
      }
      if (!this.primary.paused && !this.primary.ended && secondary.paused) {
        void secondary.play().catch(() => {});
      }
    };

    this.primary.addEventListener('play', onPlay);
    this.primary.addEventListener('pause', onPause);
    this.primary.addEventListener('seeking', onSeeking);
    this.primary.addEventListener('seeked', onSeeked);
    this.primary.addEventListener('ratechange', onRateChange);
    this.primary.addEventListener('timeupdate', onTimeUpdate);

    const detach = (): void => {
      this.primary.removeEventListener('play', onPlay);
      this.primary.removeEventListener('pause', onPause);
      this.primary.removeEventListener('seeking', onSeeking);
      this.primary.removeEventListener('seeked', onSeeked);
      this.primary.removeEventListener('ratechange', onRateChange);
      this.primary.removeEventListener('timeupdate', onTimeUpdate);
      this.unbinds.delete(secondary);
    };

    this.unbinds.set(secondary, detach);
    return detach;
  }

  detach(secondary: HTMLMediaElement): void {
    const unbind = this.unbinds.get(secondary);
    if (unbind) {
      unbind();
    }
  }

  dispose(): void {
    for (const unbind of Array.from(this.unbinds.values())) {
      unbind();
    }
    this.unbinds.clear();
  }
}
