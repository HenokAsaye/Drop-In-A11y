import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';

import type { Connect, Plugin } from 'vite';

const URL_PREFIX = '/documents/';

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml',
};

interface DocumentFile {
  path: string;
  size: number;
  type: string;
}

/**
 * Serve the lesson notes in `root` at `/documents/` from the dev and preview servers, so the
 * player's document links open without the media container. Only HTML, PDF, and SVG files inside
 * `root` are reachable; symlinks that point outside it are refused.
 */
export function lessonDocumentsPlugin(root: string): Plugin {
  const middleware = serveDocuments(root);
  return {
    name: 'lesson-documents',
    configureServer: (server) => {
      server.middlewares.use(middleware);
    },
    configurePreviewServer: (server) => {
      server.middlewares.use(middleware);
    },
  };
}

function serveDocuments(root: string): Connect.NextHandleFunction {
  return (request, response, next) => {
    const pathname = (request.url ?? '').split(/[?#]/, 1)[0] ?? '';
    if (!pathname.startsWith(URL_PREFIX)) {
      next();
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('allow', 'GET, HEAD');
      end(response, 405);
      return;
    }

    let name: string;
    try {
      name = decodeURIComponent(pathname.slice(URL_PREFIX.length));
    } catch {
      end(response, 400);
      return;
    }

    findDocument(root, name)
      .then((file) => {
        if (file === null) {
          end(response, 404);
          return;
        }
        response.setHeader('content-type', file.type);
        response.setHeader('content-length', file.size);
        response.setHeader('x-content-type-options', 'nosniff');
        if (request.method === 'HEAD') {
          response.end();
          return;
        }
        createReadStream(file.path)
          .on('error', () => response.destroy())
          .pipe(response);
      })
      .catch(next);
  };
}

async function findDocument(root: string, name: string): Promise<DocumentFile | null> {
  const type = CONTENT_TYPES[extname(name).toLowerCase()];
  if (type === undefined) return null;
  try {
    const [realRoot, realFile] = await Promise.all([realpath(root), realpath(resolve(root, name))]);
    if (!isInside(realRoot, realFile)) return null;
    const info = await stat(realFile);
    return info.isFile() ? { path: realFile, size: info.size, type } : null;
  } catch {
    return null;
  }
}

function isInside(root: string, file: string): boolean {
  const path = relative(root, file);
  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

function end(response: ServerResponse, status: number): void {
  response.statusCode = status;
  response.end();
}
