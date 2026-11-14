/** Wraps the main HTML5 <video> and is the single source of truth for playback state. */
export class MediaController {
  constructor(protected readonly video: HTMLVideoElement) {}

  togglePlay(): Promise<void> {
    throw new Error('Not implemented: MediaController.togglePlay');
  }

  seekBy(_seconds: number): void {
    throw new Error('Not implemented: MediaController.seekBy');
  }

  seekTo(_seconds: number): void {
    throw new Error('Not implemented: MediaController.seekTo');
  }

  changeVolume(_delta: number): void {
    throw new Error('Not implemented: MediaController.changeVolume');
  }

  toggleMute(): void {
    throw new Error('Not implemented: MediaController.toggleMute');
  }

  setPlaybackRate(_rate: number): void {
    throw new Error('Not implemented: MediaController.setPlaybackRate');
  }

  toggleFullscreen(_container: HTMLElement): Promise<void> {
    throw new Error('Not implemented: MediaController.toggleFullscreen');
  }
}
