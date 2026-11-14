export type PlayerAction =
  | 'toggle-play'
  | 'seek-backward'
  | 'seek-forward'
  | 'volume-up'
  | 'volume-down'
  | 'toggle-mute'
  | 'toggle-fullscreen';

/** Keyboard map from the specification (section 5.1), keyed by KeyboardEvent.key. */
export const KEYBOARD_SHORTCUTS: Readonly<Record<string, PlayerAction>> = Object.freeze({
  ' ': 'toggle-play',
  ArrowLeft: 'seek-backward',
  ArrowRight: 'seek-forward',
  ArrowUp: 'volume-up',
  ArrowDown: 'volume-down',
  m: 'toggle-mute',
  M: 'toggle-mute',
  f: 'toggle-fullscreen',
  F: 'toggle-fullscreen',
});

/** Resolve a key event to a player action; never while the learner is typing in an editable control. */
export function resolveShortcut(_event: KeyboardEvent): PlayerAction | null {
  throw new Error('Not implemented: resolveShortcut');
}
