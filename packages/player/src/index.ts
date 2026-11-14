import '@savanna/career';
import './components/savanna-player';
import './sign-language/sign-language-window';
import './transcript/transcript-panel';

export { SavannaPlayer } from './components/savanna-player';
export { SignLanguageWindow } from './sign-language/sign-language-window';
export { TranscriptPanel } from './transcript/transcript-panel';
export { LessonClient } from './api/lesson-client';
export { MediaSync } from './media/media-sync';
export {
  KEYBOARD_SHORTCUTS,
  SEEK_STEP_SECONDS,
  VOLUME_STEP,
  resolveShortcut,
} from './accessibility/keyboard-shortcuts';
export type { PlayerAction } from './accessibility/keyboard-shortcuts';
export {
  DEFAULT_CAPTION_SETTINGS,
  loadCaptionSettings,
  saveCaptionSettings,
} from './captions/caption-settings';
export type { CaptionSettings } from './captions/caption-settings';
