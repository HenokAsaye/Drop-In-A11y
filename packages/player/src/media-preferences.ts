export const FORCED_COLORS_QUERY = '(forced-colors: active)';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function mediaMatches(query: string): boolean {
  return mediaQuery(query)?.matches === true;
}

/** Follow a media query until the returned function is called. */
export function watchMedia(query: string, onChange: (matches: boolean) => void): () => void {
  const list = mediaQuery(query);
  if (list === null) return () => undefined;
  const listener = (): void => onChange(list.matches);
  if (typeof list.addEventListener === 'function') {
    list.addEventListener('change', listener);
    return () => list.removeEventListener('change', listener);
  }
  return () => undefined;
}

function mediaQuery(query: string): MediaQueryList | null {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
    return window.matchMedia(query);
  } catch {
    return null;
  }
}
