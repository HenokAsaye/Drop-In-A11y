import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, loadEnv } from 'vite';
import type { Connect, ViteDevServer } from 'vite';

const documentsRoot = fileURLToPath(new URL('../../assets/documents/', import.meta.url));
const documentsPrefix = documentsRoot.endsWith(sep) ? documentsRoot : `${documentsRoot}${sep}`;

const documentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml',
};

function lessonDocuments(): Connect.NextHandleFunction {
  return (request, response, next) => {
    const pathname = decodeURIComponent((request.url ?? '').split('?')[0] ?? '');
    const prefix = '/documents/';
    if (!pathname.startsWith(prefix)) {
      next();
      return;
    }
    const relative = normalize(pathname.slice(prefix.length));
    if (relative.startsWith('..') || relative.includes(`..${sep}`)) {
      response.statusCode = 400;
      response.end();
      return;
    }
    const file = join(documentsPrefix, relative);
    if (!file.startsWith(documentsPrefix) || !existsSync(file) || !statSync(file).isFile()) {
      next();
      return;
    }
    response.setHeader('content-type', documentTypes[extname(file)] ?? 'application/octet-stream');
    createReadStream(file).pipe(response);
  };
}

function documentsPlugin() {
  const attach = (server: ViteDevServer) => {
    server.middlewares.use(lessonDocuments());
  };
  return {
    name: 'lesson-documents',
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiBase = env.VITE_SAVANNA_API_BASE ?? 'http://localhost:8000';

  return {
    // GitHub Pages serves the demo from /<repo>/; set DEMO_BASE_PATH in CD.
    base: process.env.DEMO_BASE_PATH ?? '/',
    plugins: [
      documentsPlugin(),
      {
        name: 'savanna-api-base',
        transformIndexHtml: (html) => html.replaceAll('__SAVANNA_API_BASE__', apiBase),
      },
    ],
    server: { port: 5173 },
    preview: { port: 4173 },
  };
});
