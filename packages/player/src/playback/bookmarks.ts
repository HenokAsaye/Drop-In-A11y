import { LESSON_BOOKMARKS_KEY } from '../config';

export { LESSON_BOOKMARKS_KEY };

export interface BookmarkStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SentenceBookmark {
  start: number;
  text: string;
}

export type BookmarkWriteStatus =
  'added' | 'removed' | 'duplicate' | 'limit' | 'unavailable' | 'rejected';

export interface BookmarkWrite {
  bookmarks: SentenceBookmark[];
  status: BookmarkWriteStatus;
}

export const MAX_BOOKMARKS_PER_LANGUAGE = 50;

const MAX_BOOKMARK_TEXT = 1000;
const LESSON_ID_LIMIT = 200;
const LANGUAGE = /^[a-z]{2,3}$/;

export function readBookmarks(
  lessonId: string,
  language: string,
  storage?: BookmarkStore,
): SentenceBookmark[] {
  const id = cleanLessonId(lessonId);
  const lang = cleanLanguage(language);
  if (id === null || lang === null) return [];
  return readTree(storage)?.[id]?.[lang] ?? [];
}

export function addBookmark(
  lessonId: string,
  language: string,
  bookmark: { start: number; text: string },
  storage?: BookmarkStore,
): BookmarkWrite {
  const id = cleanLessonId(lessonId);
  const lang = cleanLanguage(language);
  const cleaned = cleanBookmark(bookmark);
  if (id === null || lang === null || cleaned === null) {
    return { bookmarks: readBookmarks(lessonId, language, storage), status: 'rejected' };
  }
  const tree = readTree(storage);
  if (tree === null) return { bookmarks: [], status: 'unavailable' };
  const current = tree[id]?.[lang] ?? [];
  if (current.some((item) => item.start === cleaned.start)) {
    return { bookmarks: current, status: 'duplicate' };
  }
  if (current.length >= MAX_BOOKMARKS_PER_LANGUAGE) {
    return { bookmarks: current, status: 'limit' };
  }
  const bookmarks = [...current, cleaned];
  const lesson = { ...(tree[id] ?? {}), [lang]: bookmarks };
  const saved = writeTree({ ...tree, [id]: lesson }, storage);
  if (!saved) return { bookmarks: current, status: 'unavailable' };
  return { bookmarks, status: 'added' };
}

export function removeBookmark(
  lessonId: string,
  language: string,
  start: number,
  storage?: BookmarkStore,
): BookmarkWrite {
  const id = cleanLessonId(lessonId);
  const lang = cleanLanguage(language);
  if (id === null || lang === null || typeof start !== 'number' || !Number.isFinite(start)) {
    return { bookmarks: readBookmarks(lessonId, language, storage), status: 'rejected' };
  }
  const tree = readTree(storage);
  if (tree === null) return { bookmarks: [], status: 'unavailable' };
  const current = tree[id]?.[lang] ?? [];
  const bookmarks = current.filter((item) => item.start !== start);
  const lesson = { ...(tree[id] ?? {}), [lang]: bookmarks };
  const saved = writeTree({ ...tree, [id]: lesson }, storage);
  if (!saved) return { bookmarks: current, status: 'unavailable' };
  return { bookmarks, status: 'removed' };
}

type BookmarkTree = Record<string, Record<string, SentenceBookmark[]>>;

function readTree(storage?: BookmarkStore): BookmarkTree | null {
  let raw: string | null;
  try {
    raw = resolveStore(storage).getItem(LESSON_BOOKMARKS_KEY);
  } catch {
    return null;
  }
  if (!raw) return {};
  try {
    return cleanTree(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

function writeTree(tree: BookmarkTree, storage?: BookmarkStore): boolean {
  try {
    resolveStore(storage).setItem(LESSON_BOOKMARKS_KEY, JSON.stringify(tree));
    return true;
  } catch {
    return false;
  }
}

function cleanTree(value: unknown): BookmarkTree {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const tree: BookmarkTree = {};
  for (const [lessonId, languages] of Object.entries(value)) {
    const id = cleanLessonId(lessonId);
    if (
      id === null ||
      typeof languages !== 'object' ||
      languages === null ||
      Array.isArray(languages)
    ) {
      continue;
    }
    const cleanedLanguages: Record<string, SentenceBookmark[]> = {};
    for (const [language, bookmarks] of Object.entries(languages)) {
      const lang = cleanLanguage(language);
      if (lang === null) continue;
      cleanedLanguages[lang] = cleanList(bookmarks);
    }
    tree[id] = cleanedLanguages;
  }
  return tree;
}

function cleanList(value: unknown): SentenceBookmark[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const bookmarks: SentenceBookmark[] = [];
  for (const item of value) {
    const bookmark = cleanBookmark(item);
    if (bookmark === null || seen.has(bookmark.start)) continue;
    seen.add(bookmark.start);
    bookmarks.push(bookmark);
    if (bookmarks.length === MAX_BOOKMARKS_PER_LANGUAGE) break;
  }
  return bookmarks;
}

function cleanBookmark(value: unknown): SentenceBookmark | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const source = value as { start?: unknown; text?: unknown };
  if (typeof source.start !== 'number' || !Number.isFinite(source.start) || source.start < 0) {
    return null;
  }
  if (typeof source.text !== 'string') return null;
  const text = source.text.trim().slice(0, MAX_BOOKMARK_TEXT);
  if (text === '') return null;
  return { start: source.start, text };
}

function cleanLessonId(value: string): string | null {
  const id = value.trim();
  if (id === '' || id.length > LESSON_ID_LIMIT) return null;
  return id;
}

function cleanLanguage(value: string): string | null {
  const language = value.trim().toLowerCase();
  return LANGUAGE.test(language) ? language : null;
}

function resolveStore(storage?: BookmarkStore): BookmarkStore {
  const unavailable: BookmarkStore = { getItem: () => null, setItem: () => undefined };
  if (storage) return storage;
  try {
    if (typeof localStorage === 'undefined') return unavailable;
    return localStorage;
  } catch {
    return unavailable;
  }
}
