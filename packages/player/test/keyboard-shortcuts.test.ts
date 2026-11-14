import { afterEach, describe, expect, it } from 'vitest';

import {
  KEYBOARD_SHORTCUTS,
  SEEK_STEP_SECONDS,
  VOLUME_STEP,
  resolveShortcut,
  type PlayerAction,
} from '../src/accessibility/keyboard-shortcuts';

function press(
  target: HTMLElement,
  player: HTMLElement,
  init: KeyboardEventInit,
): { action: PlayerAction | null; event: KeyboardEvent } {
  let action: PlayerAction | null = null;
  const listener = (event: KeyboardEvent) => {
    action = resolveShortcut(event, player);
  };
  target.addEventListener('keydown', listener);
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    composed: true,
    ...init,
  });
  target.dispatchEvent(event);
  target.removeEventListener('keydown', listener);
  return { action, event };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('keyboard shortcuts (spec 5.1)', () => {
  it.each([
    [' ', 'toggle-play'],
    ['ArrowLeft', 'seek-backward'],
    ['ArrowRight', 'seek-forward'],
    ['ArrowUp', 'volume-up'],
    ['ArrowDown', 'volume-down'],
    ['m', 'toggle-mute'],
    ['f', 'toggle-fullscreen'],
  ])('maps %j to %s', (key, action) => {
    expect(KEYBOARD_SHORTCUTS[key]).toBe(action);
  });

  it('seeks by 5 seconds and changes volume by 10 percent', () => {
    expect(SEEK_STEP_SECONDS).toBe(5);
    expect(VOLUME_STEP).toBe(0.1);
  });

  it('returns the action and prevents scrolling while focus is inside the player', () => {
    const player = document.createElement('div');
    const control = document.createElement('button');
    player.append(control);
    document.body.append(player);

    const { action, event } = press(control, player, { key: 'ArrowDown' });

    expect(action).toBe('volume-down');
    expect(event.defaultPrevented).toBe(true);
  });

  it('handles uppercase mute and fullscreen keys produced with Shift', () => {
    const player = document.createElement('div');
    document.body.append(player);

    expect(press(player, player, { key: 'M', shiftKey: true }).action).toBe('toggle-mute');
    expect(press(player, player, { key: 'F', shiftKey: true }).action).toBe('toggle-fullscreen');
  });

  it.each(['input', 'textarea', 'select'])('ignores shortcuts while focus is in an %s', (tag) => {
    const player = document.createElement('div');
    const field = document.createElement(tag);
    player.append(field);
    document.body.append(player);

    const { action, event } = press(field, player, { key: ' ' });

    expect(action).toBeNull();
    expect(event.defaultPrevented).toBe(false);
  });

  it('ignores shortcuts while focus is in a contenteditable, including its children', () => {
    const player = document.createElement('div');
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    const text = document.createElement('span');
    editor.append(text);
    player.append(editor);
    document.body.append(player);

    const onEditor = press(editor, player, { key: 'ArrowLeft' });
    const onChild = press(text, player, { key: 'ArrowRight' });

    expect(onEditor.action).toBeNull();
    expect(onEditor.event.defaultPrevented).toBe(false);
    expect(onChild.action).toBeNull();
    expect(onChild.event.defaultPrevented).toBe(false);
  });

  it('ignores shortcuts in an editable control inside the player shadow tree', () => {
    const player = document.createElement('div');
    const shadow = player.attachShadow({ mode: 'open' });
    const search = document.createElement('input');
    shadow.append(search);
    document.body.append(player);

    const { action, event } = press(search, player, { key: 'ArrowDown' });

    expect(action).toBeNull();
    expect(event.defaultPrevented).toBe(false);
  });

  it.each(['ctrlKey', 'altKey', 'metaKey'] as const)('ignores shortcuts with %s', (modifier) => {
    const player = document.createElement('div');
    document.body.append(player);

    const { action, event } = press(player, player, { key: 'ArrowDown', [modifier]: true });

    expect(action).toBeNull();
    expect(event.defaultPrevented).toBe(false);
  });

  it('only handles keys while focus is inside the player', () => {
    const player = document.createElement('div');
    const outside = document.createElement('button');
    document.body.append(player, outside);

    const inside = press(player, player, { key: ' ' });
    const outsidePress = press(outside, player, { key: ' ' });

    expect(inside.action).toBe('toggle-play');
    expect(inside.event.defaultPrevented).toBe(true);
    expect(outsidePress.action).toBeNull();
    expect(outsidePress.event.defaultPrevented).toBe(false);
  });

  it('leaves unrelated keys to the browser', () => {
    const player = document.createElement('div');
    document.body.append(player);

    const { action, event } = press(player, player, { key: 'k' });

    expect(action).toBeNull();
    expect(event.defaultPrevented).toBe(false);
  });
});
