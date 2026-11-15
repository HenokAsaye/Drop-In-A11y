import { afterEach, describe, expect, it } from 'vitest';

import { LESSON_BOOKMARKS_KEY, LESSON_POSITIONS_KEY, PLAYBACK_SETTINGS_KEY } from '../src/config';
import {
  MAX_BOOKMARKS_PER_LANGUAGE,
  addBookmark,
  readBookmarks,
  removeBookmark,
  type BookmarkStore,
} from '../src/playback/bookmarks';

function memoryStore(initial = ''): BookmarkStore & { raw: string } {
  const store = {
    raw: initial,
    getItem(key: string) {
      return key === LESSON_BOOKMARKS_KEY ? store.raw : null;
    },
    setItem(key: string, value: string) {
      if (key === LESSON_BOOKMARKS_KEY) store.raw = value;
    },
  };
  return store;
}

afterEach(() => {
  localStorage.clear();
});

describe('sentence bookmarks', () => {
  it('saves, reloads, and removes a bookmark without using playback memory', () => {
    const saved = addBookmark('networking-101', 'en', {
      start: 12,
      text: '  How computers connect  ',
    });
    expect(saved.status).toBe('added');
    expect(saved.bookmarks).toEqual([{ start: 12, text: 'How computers connect' }]);
    expect(readBookmarks('networking-101', 'en')).toEqual(saved.bookmarks);
    expect(localStorage.getItem(LESSON_POSITIONS_KEY)).toBeNull();
    expect(localStorage.getItem(PLAYBACK_SETTINGS_KEY)).toBeNull();

    const removed = removeBookmark('networking-101', 'en', 12);
    expect(removed.status).toBe('removed');
    expect(readBookmarks('networking-101', 'en')).toEqual([]);
  });

  it('keeps lessons and languages apart and ignores a duplicate start time', () => {
    addBookmark('networking-101', 'en', { start: 0, text: 'Welcome' });
    addBookmark('networking-101', 'am', { start: 0, text: 'እንኳን' });
    addBookmark('routing-201', 'en', { start: 8, text: 'Routing' });
    const duplicate = addBookmark('networking-101', 'en', {
      start: 0,
      text: 'A different sentence',
    });

    expect(duplicate.status).toBe('duplicate');
    expect(readBookmarks('networking-101', 'en')).toEqual([{ start: 0, text: 'Welcome' }]);
    expect(readBookmarks('networking-101', 'am')).toEqual([{ start: 0, text: 'እንኳን' }]);
    expect(readBookmarks('routing-201', 'en')).toEqual([{ start: 8, text: 'Routing' }]);
  });

  it('stops at the bookmark limit', () => {
    for (let start = 0; start < MAX_BOOKMARKS_PER_LANGUAGE; start += 1) {
      expect(addBookmark('networking-101', 'en', { start, text: `Sentence ${start}` }).status).toBe(
        'added',
      );
    }
    const extra = addBookmark('networking-101', 'en', { start: 500, text: 'One more' });
    expect(extra.status).toBe('limit');
    expect(extra.bookmarks).toHaveLength(MAX_BOOKMARKS_PER_LANGUAGE);
    expect(extra.bookmarks.some((bookmark) => bookmark.text === 'One more')).toBe(false);
  });

  it('ignores invalid stored bookmarks and unavailable storage', () => {
    const store = memoryStore(
      JSON.stringify({
        'networking-101': {
          en: [
            { start: 4, text: 'Kept' },
            { start: -1, text: 'Too early' },
            { start: 4, text: 'Duplicate' },
            { start: 6, text: '   ' },
            { text: 'Missing time' },
          ],
          am: [{ start: 1, text: 'አማርኛ' }],
        },
      }),
    );

    expect(readBookmarks('networking-101', 'en', store)).toEqual([{ start: 4, text: 'Kept' }]);
    expect(
      addBookmark('networking-101', 'en', { start: 4, text: 'Kept again' }, store).status,
    ).toBe('duplicate');

    const blocked: BookmarkStore = {
      getItem() {
        throw new Error('storage blocked');
      },
      setItem() {
        throw new Error('storage blocked');
      },
    };
    expect(readBookmarks('networking-101', 'en', blocked)).toEqual([]);
    expect(addBookmark('networking-101', 'en', { start: 1, text: 'Hello' }, blocked).status).toBe(
      'unavailable',
    );
    expect(removeBookmark('networking-101', 'en', 1, blocked).status).toBe('unavailable');
  });
});
