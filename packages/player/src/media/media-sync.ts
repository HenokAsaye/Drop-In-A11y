/**
 * Keeps secondary media (sign-language video, audio description) following the main video
 * on play, pause, seek and playback-rate changes.
 */
export class MediaSync {
  constructor(protected readonly primary: HTMLMediaElement) {}

  attach(_secondary: HTMLMediaElement): () => void {
    throw new Error('Not implemented: MediaSync.attach');
  }

  dispose(): void {
    throw new Error('Not implemented: MediaSync.dispose');
  }
}
