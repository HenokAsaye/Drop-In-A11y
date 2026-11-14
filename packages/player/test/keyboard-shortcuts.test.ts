import { describe, expect, it } from 'vitest';

import { KEYBOARD_SHORTCUTS } from '../src/accessibility/keyboard-shortcuts';

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

  it.todo('ignores shortcuts while focus is in an input, textarea, select or contenteditable');
  it.todo('ignores shortcuts with Ctrl, Alt or Meta modifiers');
  it.todo('only handles keys while focus is inside the player');
});
