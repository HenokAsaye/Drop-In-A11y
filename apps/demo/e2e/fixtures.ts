import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { Page } from '@playwright/test';

/** Eight seconds of silent WebM, small enough to commit. Chromium plays it without codecs. */
const VIDEO = readFileSync(fileURLToPath(new URL('./fixtures/lesson.webm', import.meta.url)));

export const VIDEO_URL = '/test-media/lesson.webm';
export const SIGN_URL = '/test-media/sign.webm';

export const TRANSCRIPTS = {
  en: [
    { start: 0, end: 2, text: 'Welcome to our networking lesson.' },
    { start: 2, end: 4, text: 'Computers connect through switches.' },
    { start: 4, end: 6, text: 'Every device has an address.' },
  ],
  am: [
    { start: 0, end: 2, text: 'እንኳን ወደ ኔትወርክ ትምህርታችን በደህና መጡ።' },
    { start: 2, end: 4, text: 'ኮምፒውተሮች በስዊች ይገናኛሉ።' },
    { start: 4, end: 6, text: 'እያንዳንዱ መሣሪያ አድራሻ አለው።' },
  ],
} as const;

/** The shape of the seeded `networking-101` lesson, with media the test server can answer. */
export const LESSON = {
  id: 'networking-101',
  title: 'Introduction to Computer Networking',
  description: 'Learn the fundamentals of computer networking.',
  language: 'en',
  media: {
    video: VIDEO_URL,
    audio: null,
    signLanguage: SIGN_URL,
    audioDescription: null,
    poster: null,
  },
  captions: [],
  transcripts: [],
  documents: [],
};

/** Answer every API and media request the lesson makes, so the suite needs no running API. */
export async function mockLesson(page: Page, lesson: object = LESSON): Promise<void> {
  const media = (route: { fulfill: (o: object) => Promise<void> }) =>
    route.fulfill({ body: VIDEO, contentType: 'video/webm' });
  await page.route('**/test-media/*.webm', media);

  await page.route(/\/api\/v1\/lessons\/networking-101(\?.*)?$/, (route) =>
    route.fulfill({ json: lesson }),
  );
  await page.route(/\/api\/v1\/lessons\/networking-101\/transcript/, (route) => {
    const language =
      new URL(route.request().url()).searchParams.get('language') === 'am' ? 'am' : 'en';
    return route.fulfill({ json: { language, segments: TRANSCRIPTS[language] } });
  });
  await page.route(/\/api\/v1\/lessons\/networking-101\/captions/, (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route(/\/api\/v1\/lessons\/networking-101\/documents/, (route) =>
    route.fulfill({ json: [] }),
  );
}
