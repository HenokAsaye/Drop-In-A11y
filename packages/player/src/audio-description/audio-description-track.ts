/** Prerecorded audio-description track played in sync with the lesson. */
export class AudioDescriptionTrack {
  constructor(protected readonly src: string) {}

  enable(_primary: HTMLMediaElement): void {
    throw new Error('Not implemented: AudioDescriptionTrack.enable');
  }

  disable(): void {
    throw new Error('Not implemented: AudioDescriptionTrack.disable');
  }
}
