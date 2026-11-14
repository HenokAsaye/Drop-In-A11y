/**
 * The public contract between a host website and the plugin. Changing anything here is a
 * breaking change for every site that embeds <savanna-player>.
 */

export const PLAYER_TAG = 'savanna-player';

export interface SavannaPlayerAttributes {
  /** Lesson identifier, e.g. "networking-101". Required. */
  'lesson-id': string;
  /** Base URL of the BridgePlayer API, e.g. "https://api.example.com". Required. */
  'api-base': string;
  /** Initial caption language (BCP 47), e.g. "en" or "am". */
  'caption-language'?: string;
  /** Initial interface language for player labels. */
  lang?: string;
  /**
   * URL of `savanna-sw.js` on the host's own origin. Optional; defaults to "/savanna-sw.js".
   * Service workers are same-origin only, so the host must serve the file itself.
   */
  'sw-url'?: string;
}

export type PlayerStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export interface SavannaPlayerEventMap {
  'savanna-status-change': CustomEvent<{ status: PlayerStatus }>;
  'savanna-error': CustomEvent<{ message: string; cause?: unknown }>;
}

export type SavannaPlayerEventName = keyof SavannaPlayerEventMap;
