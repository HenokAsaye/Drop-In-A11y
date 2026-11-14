import type { CaptionTrack } from '@savanna/contracts';

import type { CaptionSettings } from './caption-settings';

/** Adds WebVTT <track> elements for English and Amharic and applies the learner's caption settings. */
export class CaptionManager {
  constructor(protected readonly video: HTMLVideoElement) {}

  loadTracks(_tracks: CaptionTrack[]): void {
    throw new Error('Not implemented: CaptionManager.loadTracks');
  }

  apply(_settings: CaptionSettings): void {
    throw new Error('Not implemented: CaptionManager.apply');
  }
}
