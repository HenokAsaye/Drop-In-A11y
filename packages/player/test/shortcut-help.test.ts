import { afterEach, describe, expect, it, vi } from 'vitest';

import '../src/index';
import type { SavannaPlayer } from '../src/components/savanna-player';

async function mount(): Promise<SavannaPlayer> {
  const player = document.createElement('savanna-player');
  player.setAttribute('lesson-id', 'networking-101');
  player.setAttribute('api-base', 'https://api.example');
  document.body.append(player);
  await player.updateComplete;
  return player;
}

function helpButton(player: SavannaPlayer): HTMLButtonElement {
  const button = player.shadowRoot?.querySelector<HTMLButtonElement>('.shortcut-help-btn');
  if (button === null || button === undefined) throw new Error('shortcut help button is missing');
  return button;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('keyboard shortcut help', () => {
  it('toggles a non-modal help region and leaves Space to the button', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    const player = await mount();
    const button = helpButton(player);
    const region = player.shadowRoot?.querySelector<HTMLElement>('#shortcut-help');
    if (region === null || region === undefined) throw new Error('shortcut help region is missing');

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe('shortcut-help');
    expect(region.hidden).toBe(true);
    expect(region.getAttribute('role')).toBe('region');
    expect(region.getAttribute('aria-modal')).toBeNull();

    const space = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    button.dispatchEvent(space);
    expect(space.defaultPrevented).toBe(false);
    expect(player.isPaused).toBe(true);

    button.click();
    await player.updateComplete;
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(region.hidden).toBe(false);

    const help = region.textContent ?? '';
    expect(help).toContain('Space activates a focused button');
    expect(help).toContain('Enter opens a focused link');
    expect(help).toContain('Left and Right arrows');
    expect(help).toContain('Up and Down arrows');
    expect(help).toContain('M mutes or unmutes');
    expect(help).toContain('F enters or leaves fullscreen');
    expect(help).toContain('sign-language move handle is focused');
    expect(help).toContain('resize handle is focused');
    expect(help).toContain('also reach the player shortcuts');

    button.focus();
    expect(player.shadowRoot?.activeElement).toBe(button);
    const play = player.shadowRoot?.querySelector<HTMLButtonElement>('.play-btn');
    play?.focus();
    expect(player.shadowRoot?.activeElement).toBe(play);

    button.click();
    await player.updateComplete;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(region.hidden).toBe(true);
  });
});
