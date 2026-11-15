const WEB_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Parse a URL that came from API data and return it only when it uses http or https.
 * Relative values resolve against `base`. Run API data through this before it reaches an `href`
 * or `src`, so a `javascript:` or `data:` URL can never run in the host page.
 */
export function webUrl(value: string | null | undefined, base?: string): string | null {
  const raw = value?.trim() ?? '';
  if (raw === '') return null;
  try {
    const url = new URL(raw, base);
    return WEB_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
