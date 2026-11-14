import { defineConfig } from 'vite';

// The service worker ships as its own file: it must be served from the host site's origin.
export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: true,
    lib: {
      entry: 'src/service-worker.ts',
      formats: ['iife'],
      name: 'SavannaServiceWorker',
      fileName: () => 'savanna-sw.js',
    },
  },
});
