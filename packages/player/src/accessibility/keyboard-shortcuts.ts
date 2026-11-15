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

export { SEEK_STEP_SECONDS, VOLUME_STEP } from '../config';

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const ACTIVATION_KEY = ' ';

/**
 * Resolve a keydown to a player action.
 * Returns null when a Ctrl, Alt, or Meta modifier is held, when focus is in an editable control
 * or on a link, when Space is pressed on a button (Space activates that button instead), or when
 * focus is outside `player`. A handled shortcut calls preventDefault.
 */
export function resolveShortcut(event: KeyboardEvent, player: HTMLElement): PlayerAction | null {
  if (event.ctrlKey || event.altKey || event.metaKey) return null;

  const target = focusedTarget(event);
  if (isEditable(target) || isLink(target) || !isInsidePlayer(target, player)) return null;
  if (event.key === ACTIVATION_KEY && isButton(target)) return null;

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

function isLink(target: EventTarget | null): boolean {
  return target instanceof HTMLAnchorElement && target.hasAttribute('href');
}

function isButton(target: EventTarget | null): boolean {
  if (target instanceof HTMLButtonElement) return true;
  return target instanceof HTMLElement && target.getAttribute('role') === 'button';
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
