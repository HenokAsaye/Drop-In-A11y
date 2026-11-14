/// <reference lib="webworker" />

import { matchLessonResource } from './lesson-cache';

declare const self: ServiceWorkerGlobalScope;

self.addEventListener('install', () => {
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Cache-first for downloaded lesson resources; everything else goes to the network.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    matchLessonResource(event.request, self.caches).then(
      (cached) => cached ?? fetch(event.request),
    ),
  );
});

export {};
