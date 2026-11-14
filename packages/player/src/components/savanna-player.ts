import { PLAYER_TAG, type Lesson, type PlayerStatus } from '@savanna/contracts';
import { LitElement, css, html, nothing, type PropertyValues } from 'lit';

import { Announcer } from '../accessibility/announcer';
import { resolveShortcut } from '../accessibility/keyboard-shortcuts';
import { LessonClient } from '../api/lesson-client';

const EMPTY_MESSAGE = 'This lesson has no video.';
const FAILURE_MESSAGE = 'The lesson could not be loaded.';

/**
 * <savanna-player lesson-id="..." api-base="..."> — the single entry point host websites embed.
 * Loads lesson metadata from api-base and exposes loading, ready, empty, and error states.
 */
export class SavannaPlayer extends LitElement {
  static override properties = {
    lessonId: { type: String, attribute: 'lesson-id', reflect: true },
    apiBase: { type: String, attribute: 'api-base', reflect: true },
    captionLanguage: { type: String, attribute: 'caption-language' },
    status: { state: true },
    lesson: { state: true },
  };

  static override styles = css`
    :host {
      display: block;
      font: inherit;
      color: inherit;
      line-height: 1.5;
    }
    :host([hidden]) {
      display: none;
    }
    section {
      min-height: 1.5em;
    }
    .status {
      margin: 0;
      max-width: 42rem;
      overflow-wrap: anywhere;
    }
  `;

  declare lessonId: string;
  declare apiBase: string;
  declare captionLanguage: string;
  declare status: PlayerStatus;
  declare lesson: Lesson | null;

  private abortController: AbortController | null = null;
  private requestId = 0;
  private statusMessage = '';
  private statusAnnouncer: Announcer | null = null;
  private errorAnnouncer: Announcer | null = null;
  private connectedOnce = false;
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    resolveShortcut(event, this);
  };

  constructor() {
    super();
    this.lessonId = '';
    this.apiBase = '';
    this.captionLanguage = 'en';
    this.status = 'idle';
    this.lesson = null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('keydown', this.onKeyDown);
    if (this.connectedOnce) this.beginLoad();
    this.connectedOnce = true;
  }

  override disconnectedCallback(): void {
    this.removeEventListener('keydown', this.onKeyDown);
    this.abortController?.abort();
    this.abortController = null;
    super.disconnectedCallback();
  }

  override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('lessonId') || changed.has('apiBase')) this.beginLoad();
  }

  override updated(): void {
    this.syncAnnouncement();
  }

  override render() {
    const failed = this.status === 'error';
    return html`
      <section aria-label="Lesson player" aria-busy=${this.status === 'loading' ? 'true' : nothing}>
        <p
          id="player-status"
          class="status"
          data-state=${failed ? nothing : this.status}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          ?hidden=${failed}
        ></p>
        <p id="player-error" class="status" role="alert" ?hidden=${!failed}></p>
      </section>
    `;
  }

  private beginLoad(): void {
    this.abortController?.abort();
    this.abortController = null;

    const lessonId = this.lessonId.trim();
    const apiBase = this.apiBase.trim();
    if (lessonId === '' || apiBase === '') {
      this.requestId += 1;
      this.setOutcome('idle', '', null);
      return;
    }

    const controller = new AbortController();
    this.abortController = controller;
    const requestId = ++this.requestId;
    this.setOutcome('loading', `Loading lesson ${lessonId}.`, null);
    void this.finishLoad(new LessonClient(apiBase), lessonId, controller, requestId);
  }

  private async finishLoad(
    client: LessonClient,
    lessonId: string,
    controller: AbortController,
    requestId: number,
  ): Promise<void> {
    try {
      const lesson = await client.getLesson(lessonId, controller.signal);
      if (!this.isCurrent(requestId, controller)) return;
      const outcome = describeLesson(lesson);
      this.setOutcome(outcome.status, outcome.message, lesson);
    } catch (error: unknown) {
      if (!this.isCurrent(requestId, controller) || isAbortError(error)) return;
      const message =
        error instanceof Error && error.message.trim() ? error.message : FAILURE_MESSAGE;
      this.setOutcome('error', message, null);
      this.dispatchEvent(
        new CustomEvent('savanna-error', {
          detail: { message, cause: error },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private setOutcome(status: PlayerStatus, message: string, lesson: Lesson | null): void {
    const statusChanged = this.status !== status;
    this.lesson = lesson;
    this.statusMessage = message;
    this.status = status;
    if (statusChanged) {
      this.dispatchEvent(
        new CustomEvent('savanna-status-change', {
          detail: { status },
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }
    this.syncAnnouncement();
  }

  private syncAnnouncement(): void {
    const statusRegion = this.renderRoot.querySelector<HTMLElement>('#player-status');
    const errorRegion = this.renderRoot.querySelector<HTMLElement>('#player-error');
    if (statusRegion === null || errorRegion === null) return;
    this.statusAnnouncer ??= new Announcer(statusRegion);
    this.errorAnnouncer ??= new Announcer(errorRegion);
    if (this.status === 'error') {
      this.errorAnnouncer.announce(this.statusMessage);
      this.statusAnnouncer.announce('');
      return;
    }
    this.statusAnnouncer.announce(this.statusMessage);
    this.errorAnnouncer.announce('');
  }

  private isCurrent(requestId: number, controller: AbortController): boolean {
    return this.isConnected && this.requestId === requestId && !controller.signal.aborted;
  }
}

function describeLesson(lesson: Lesson): { status: 'ready' | 'empty'; message: string } {
  const video = lesson.media?.video;
  if (typeof video !== 'string' || video.trim() === '') {
    return { status: 'empty', message: EMPTY_MESSAGE };
  }
  const title = lesson.title.trim();
  return { status: 'ready', message: title === '' ? 'Lesson ready.' : `Lesson ready: ${title}.` };
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  );
}

if (!customElements.get(PLAYER_TAG)) {
  customElements.define(PLAYER_TAG, SavannaPlayer);
}

declare global {
  interface HTMLElementTagNameMap {
    'savanna-player': SavannaPlayer;
  }
}
