import { fileURLToPath } from 'node:url';

import { defineConfig, loadEnv } from 'vite';

import { lessonDocumentsPlugin } from './vite-plugins/lesson-documents.ts';

const documentsRoot = fileURLToPath(new URL('../../assets/documents/', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiBase = env.VITE_SAVANNA_API_BASE ?? 'http://localhost:8000';

  return {
    // GitHub Pages serves the demo from /<repo>/; set DEMO_BASE_PATH in CD.
    base: process.env.DEMO_BASE_PATH ?? '/',
    plugins: [
      lessonDocumentsPlugin(documentsRoot),
      {
        name: 'savanna-api-base',
        transformIndexHtml: (html) => html.replaceAll('__SAVANNA_API_BASE__', apiBase),
      },
    ],
    server: { port: 5173 },
    preview: { port: 4173 },
  };
});
