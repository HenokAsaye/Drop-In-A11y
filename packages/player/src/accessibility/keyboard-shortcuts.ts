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

/** One Left or Right press seeks by this many seconds. */
export const SEEK_STEP_SECONDS = 5;

/** One Up or Down press changes volume by this fraction of the full range (10%). */
export const VOLUME_STEP = 0.1;

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Resolve a keydown to a player action.
 * Returns null when a Ctrl, Alt, or Meta modifier is held, when focus is in an editable control,
 * or when focus is outside `player`. A handled shortcut calls preventDefault.
 */
export function resolveShortcut(event: KeyboardEvent, player: HTMLElement): PlayerAction | null {
  if (event.ctrlKey || event.altKey || event.metaKey) return null;

  const target = focusedTarget(event);
  if (isEditable(target) || !isInsidePlayer(target, player)) return null;

  const action = KEYBOARD_SHORTCUTS[event.key];
  if (action === undefined) return null;

  event.preventDefault();
  return action;
}

function focusedTarget(event: KeyboardEvent): EventTarget | null {
  const path = event.composedPath();
  return path[0] ?? event.target;
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || EDITABLE_TAGS.has(target.tagName);
}

function isInsidePlayer(target: EventTarget | null, player: HTMLElement): boolean {
  if (!(target instanceof Node)) return false;

  let current: Node | null = target;
  while (current !== null) {
    if (current === player) return true;
    if (current instanceof Element && current.parentElement !== null) {
      current = current.parentElement;
      continue;
    }
    const root = current.getRootNode();
    if (root instanceof ShadowRoot && root.host !== current) {
      current = root.host;
      continue;
    }
    return false;
  }
  return false;
}
