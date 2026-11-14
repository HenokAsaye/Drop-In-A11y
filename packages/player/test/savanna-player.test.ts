import { afterEach, describe, expect, it } from 'vitest';

import '../src/index';
import { SavannaPlayer } from '../src/components/savanna-player';

async function mount(attributes: Record<string, string>): Promise<SavannaPlayer> {
  const element = document.createElement('savanna-player');
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  document.body.append(element);
  await element.updateComplete;
  return element;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('<savanna-player> integration contract', () => {
  it('registers the custom element', () => {
    expect(customElements.get('savanna-player')).toBe(SavannaPlayer);
  });

  it('reads lesson-id and api-base attributes', async () => {
    const player = await mount({
      'lesson-id': 'networking-101',
      'api-base': 'https://api.example',
    });

    expect(player.lessonId).toBe('networking-101');
    expect(player.apiBase).toBe('https://api.example');
  });

  it('renders inside a shadow root with a labelled region', async () => {
    const player = await mount({ 'lesson-id': 'networking-101' });

    const region = player.shadowRoot?.querySelector('section');
    expect(region?.getAttribute('aria-label')).toBe('Lesson player');
  });

  it('survives the bundle being loaded twice on the same page', async () => {
    await expect(import('../src/components/savanna-player')).resolves.toBeDefined();
  });
});

describe('<savanna-player> lesson loading (spec 2.3, 4.1)', () => {
  it.todo('requests lesson metadata from api-base when lesson-id is set');
  it.todo('exposes a loading state announced to screen readers');
  it.todo('exposes an empty state when the lesson has no media');
  it.todo('exposes an error state and emits savanna-error when the API fails');
  it.todo('reloads when lesson-id changes and aborts the previous request');
});

describe('<savanna-player> video controls (spec 4.1)', () => {
  it.todo('play/pause, seek, volume, mute, speed and fullscreen use native buttons and inputs');
  it.todo('every control has an accessible name');
  it.todo('focus is always visible');
  it.todo('state is not conveyed by color alone');
});
