import { LitElement, css, html } from 'lit';

import { REDUCED_MOTION_QUERY, mediaMatches, watchMedia } from '../media-preferences';

export const SIGN_LANGUAGE_TAG = 'savanna-sign-language';

const DEFAULT_WIDTH = 200;
const DEFAULT_HEIGHT = 150;
const MIN_WIDTH = 120;
const MIN_HEIGHT = 80;
const MOVE_STEP = 15;
const RESIZE_STEP = 15;

/** Movable, resizable Ethiopian Sign Language interpreter window (prerecorded, reviewed footage). */
export class SignLanguageWindow extends LitElement {
  static override properties = {
    src: { type: String },
    open: { type: Boolean, reflect: true },
    x: { type: Number },
    y: { type: Number },
    width: { type: Number },
    height: { type: Number },
    reducedMotion: { type: Boolean, reflect: true, attribute: 'reduced-motion' },
  };

  static override styles = css`
    :host {
      position: absolute;
      z-index: 10;
      display: block;
      box-sizing: border-box;
      user-select: none;
    }

    :host([hidden]) {
      display: none !important;
    }

    .window-container {
      position: relative;
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      background: #0f172a;
      border: 2px solid #334155;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    }

    .title-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.25rem 0.5rem;
      background: #1e293b;
      color: #f8fafc;
      font-size: 0.75rem;
    }

    .drag-handle {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 0.25rem;
      cursor: grab;
      outline: none;
    }

    .drag-handle:active {
      cursor: grabbing;
    }

    .drag-handle:focus-visible {
      outline: 2px solid #38bdf8;
      outline-offset: 2px;
    }

    .window-title {
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .close-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 1.5rem;
      min-height: 1.5rem;
      padding: 0.25rem;
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      border-radius: 4px;
      font-size: 0.875rem;
      line-height: 1;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #f8fafc;
    }

    .close-btn:focus-visible,
    .resize-handle:focus-visible {
      outline: 2px solid #38bdf8;
      outline-offset: 2px;
    }

    .video-container {
      position: relative;
      flex: 1;
      width: 100%;
      height: 100%;
      background: #000;
      overflow: hidden;
    }

    video {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .resize-handle {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 1.5rem;
      height: 1.5rem;
      min-width: 24px;
      min-height: 24px;
      cursor: se-resize;
      background: transparent;
      border: none;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
    }

    .resize-handle::after {
      content: '';
      position: absolute;
      right: 3px;
      bottom: 3px;
      width: 8px;
      height: 8px;
      border-right: 2px solid #94a3b8;
      border-bottom: 2px solid #94a3b8;
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    :host([reduced-motion]),
    :host([reduced-motion]) * {
      scroll-behavior: auto !important;
      transition: none !important;
      animation: none !important;
    }
  `;

  declare src: string;
  declare open: boolean;
  declare x: number;
  declare y: number;
  declare width: number;
  declare height: number;
  declare reducedMotion: boolean;

  private unwatchMotion: (() => void) | null = null;

  private isDragging = false;
  private isResizing = false;
  private startPointerX = 0;
  private startPointerY = 0;
  private startX = 0;
  private startY = 0;
  private startWidth = 0;
  private startHeight = 0;

  constructor() {
    super();
    this.src = '';
    this.open = false;
    this.width = DEFAULT_WIDTH;
    this.height = DEFAULT_HEIGHT;
    this.x = 0;
    this.y = 0;
    this.reducedMotion = false;
  }

  get videoElement(): HTMLVideoElement | null {
    return this.renderRoot?.querySelector('video') ?? null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.reducedMotion = mediaMatches(REDUCED_MOTION_QUERY);
    this.unwatchMotion = watchMedia(REDUCED_MOTION_QUERY, (matches) => {
      this.reducedMotion = matches;
    });
    this.ensureInBounds();
    window.addEventListener('resize', this.handleWindowResize);
  }

  override disconnectedCallback(): void {
    this.unwatchMotion?.();
    this.unwatchMotion = null;
    window.removeEventListener('resize', this.handleWindowResize);
    super.disconnectedCallback();
  }

  private handleWindowResize = (): void => {
    this.ensureInBounds();
  };

  show(): void {
    this.open = true;
    this.ensureInBounds();
  }

  close(): void {
    this.open = false;
    this.dispatchEvent(
      new CustomEvent('savanna-sign-language-close', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  moveTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.ensureInBounds();
  }

  moveBy(dx: number, dy: number): void {
    this.moveTo((this.x ?? 0) + dx, (this.y ?? 0) + dy);
  }

  resizeTo(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.ensureInBounds();
  }

  resizeBy(dw: number, dh: number): void {
    this.resizeTo((this.width ?? DEFAULT_WIDTH) + dw, (this.height ?? DEFAULT_HEIGHT) + dh);
  }

  private getContainerBounds(): { width: number; height: number } {
    const parent = this.parentElement ?? this.offsetParent;
    if (parent instanceof HTMLElement) {
      const w = parent.clientWidth || parent.getBoundingClientRect().width;
      const h = parent.clientHeight || parent.getBoundingClientRect().height;
      if (w > 0 && h > 0) return { width: w, height: h };
    }
    return {
      width: window.innerWidth || 640,
      height: window.innerHeight || 480,
    };
  }

  private ensureInBounds(): void {
    const { width: containerW, height: containerH } = this.getContainerBounds();

    const maxW = Math.max(MIN_WIDTH, containerW);
    const maxH = Math.max(MIN_HEIGHT, containerH);
    this.width = Math.max(MIN_WIDTH, Math.min(maxW, this.width || DEFAULT_WIDTH));
    this.height = Math.max(MIN_HEIGHT, Math.min(maxH, this.height || DEFAULT_HEIGHT));

    const maxX = Math.max(0, containerW - this.width);
    const maxY = Math.max(0, containerH - this.height);
    this.x = Math.max(0, Math.min(maxX, this.x ?? 0));
    this.y = Math.max(0, Math.min(maxY, this.y ?? 0));

    this.style.width = `${this.width}px`;
    this.style.height = `${this.height}px`;
    this.style.left = `${this.x}px`;
    this.style.top = `${this.y}px`;
  }

  private handleDragPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    this.isDragging = true;
    this.startPointerX = event.clientX;
    this.startPointerY = event.clientY;
    this.startX = this.x;
    this.startY = this.y;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', this.handleDragPointerMove);
    window.addEventListener('pointerup', this.handleDragPointerUp);
  };

  private handleDragPointerMove = (event: PointerEvent): void => {
    if (!this.isDragging) return;
    const dx = event.clientX - this.startPointerX;
    const dy = event.clientY - this.startPointerY;
    this.moveTo(this.startX + dx, this.startY + dy);
  };

  private handleDragPointerUp = (): void => {
    this.isDragging = false;
    window.removeEventListener('pointermove', this.handleDragPointerMove);
    window.removeEventListener('pointerup', this.handleDragPointerUp);
  };

  private handleResizePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    event.stopPropagation();
    this.isResizing = true;
    this.startPointerX = event.clientX;
    this.startPointerY = event.clientY;
    this.startWidth = this.width;
    this.startHeight = this.height;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', this.handleResizePointerMove);
    window.addEventListener('pointerup', this.handleResizePointerUp);
  };

  private handleResizePointerMove = (event: PointerEvent): void => {
    if (!this.isResizing) return;
    const dw = event.clientX - this.startPointerX;
    const dh = event.clientY - this.startPointerY;
    this.resizeTo(this.startWidth + dw, this.startHeight + dh);
  };

  private handleResizePointerUp = (): void => {
    this.isResizing = false;
    window.removeEventListener('pointermove', this.handleResizePointerMove);
    window.removeEventListener('pointerup', this.handleResizePointerUp);
  };

  private handleMoveKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.shiftKey) {
      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault();
          this.resizeBy(RESIZE_STEP, 0);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          this.resizeBy(-RESIZE_STEP, 0);
          break;
        case 'ArrowDown':
          event.preventDefault();
          this.resizeBy(0, RESIZE_STEP);
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.resizeBy(0, -RESIZE_STEP);
          break;
      }
      return;
    }

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        this.moveBy(MOVE_STEP, 0);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.moveBy(-MOVE_STEP, 0);
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.moveBy(0, MOVE_STEP);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveBy(0, -MOVE_STEP);
        break;
    }
  };

  private handleResizeKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        this.resizeBy(RESIZE_STEP, 0);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.resizeBy(-RESIZE_STEP, 0);
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.resizeBy(0, RESIZE_STEP);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.resizeBy(0, -RESIZE_STEP);
        break;
    }
  };

  override render() {
    this.style.width = `${this.width}px`;
    this.style.height = `${this.height}px`;
    this.style.left = `${this.x}px`;
    this.style.top = `${this.y}px`;

    return html`
      <section
        class="window-container"
        aria-label="Ethiopian Sign Language interpreter"
        ?hidden=${!this.open}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            this.close();
          }
        }}
      >
        <div class="title-bar">
          <div
            class="drag-handle"
            role="button"
            tabindex="0"
            aria-label="Move sign language window (use arrow keys to move, Shift+arrow to resize)"
            @pointerdown=${this.handleDragPointerDown}
            @keydown=${this.handleMoveKeydown}
          >
            <span class="window-title">Sign Language</span>
          </div>
          <button
            type="button"
            class="close-btn"
            @click=${this.close}
            aria-label="Close sign language window"
          >
            <span aria-hidden="true">✕</span>
            <span class="visually-hidden">Close sign language window</span>
          </button>
        </div>

        <div class="video-container">
          <video
            playsinline
            muted
            aria-label="Ethiopian Sign Language interpreter video"
            src=${this.src || ''}
          ></video>
        </div>

        <button
          type="button"
          class="resize-handle"
          aria-label="Resize sign language window (use arrow keys)"
          @pointerdown=${this.handleResizePointerDown}
          @keydown=${this.handleResizeKeydown}
        >
          <span class="visually-hidden">Resize sign language window</span>
        </button>
      </section>
    `;
  }
}

if (!customElements.get(SIGN_LANGUAGE_TAG)) {
  customElements.define(SIGN_LANGUAGE_TAG, SignLanguageWindow);
}

declare global {
  interface HTMLElementTagNameMap {
    'savanna-sign-language': SignLanguageWindow;
  }
}
