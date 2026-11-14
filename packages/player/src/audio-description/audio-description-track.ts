import { MediaSync } from '../media/media-sync';

/** Prerecorded, reviewed audio description played in sync with the lesson. */
export class AudioDescriptionTrack {
  private audio: HTMLAudioElement | null = null;
  private detach: (() => void) | null = null;
  private primary: HTMLMediaElement | null = null;
  private sync: MediaSync | null = null;
  private ownedSync: MediaSync | null = null;

  constructor(readonly source: string) {}

  get element(): HTMLAudioElement | null {
    return this.audio;
  }

  get enabled(): boolean {
    return this.detach !== null;
  }

  enable(primary: HTMLMediaElement, sync?: MediaSync): void {
    const source = this.source.trim();
    if (source === '') return;

    const nextSync = sync ?? this.ownedSync ?? new MediaSync(primary);
    if (sync === undefined) this.ownedSync = nextSync;
    if (this.detach && this.primary === primary && this.sync === nextSync && this.audio) return;

    this.releaseBinding();
    const audio = this.audio ?? document.createElement('audio');
    audio.className = 'audio-description';
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    if (audio.getAttribute('src') !== source) audio.src = source;
    this.audio = audio;
    this.primary = primary;
    this.sync = nextSync;
    this.applyVolume();
    primary.addEventListener('volumechange', this.onVolumeChange);
    this.detach = nextSync.attach(audio);
  }

  disable(): void {
    const owned = this.ownedSync;
    const active = this.sync;
    this.releaseBinding();
    this.ownedSync = null;
    if (owned && owned === active) owned.dispose();
    const audio = this.audio;
    if (!audio) return;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }

  private readonly onVolumeChange = (): void => {
    this.applyVolume();
  };

  private applyVolume(): void {
    const audio = this.audio;
    const primary = this.primary;
    if (!audio || !primary) return;
    if (Number.isFinite(primary.volume)) audio.volume = primary.volume;
    audio.muted = primary.muted;
  }

  private releaseBinding(): void {
    this.detach?.();
    this.detach = null;
    this.primary?.removeEventListener('volumechange', this.onVolumeChange);
    this.primary = null;
    this.sync = null;
  }
}
