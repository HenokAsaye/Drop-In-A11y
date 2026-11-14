import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiBase = env.VITE_SAVANNA_API_BASE ?? 'http://localhost:8000';

  return {
    // GitHub Pages serves the demo from /<repo>/; set DEMO_BASE_PATH in CD.
    base: process.env.DEMO_BASE_PATH ?? '/',
    plugins: [
      {
        name: 'savanna-api-base',
        transformIndexHtml: (html) => html.replaceAll('__SAVANNA_API_BASE__', apiBase),
      },
    ],
    server: { port: 5173 },
    preview: { port: 4173 },
  };
});
