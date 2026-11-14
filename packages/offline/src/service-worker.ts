/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

self.addEventListener('install', () => {
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Cache-first for downloaded lesson resources; everything else goes to the network.
self.addEventListener('fetch', () => {
  // Not implemented: serve responses from caches named `savanna-lesson:<id>:<version>`.
});

export {};
