// Copies the compiled plugin bundle into public/ so the demo loads it exactly like a host site would.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const files = [
  {
    from: '../../packages/player/dist/bridge-player.js',
    to: 'public/bridge-player.js',
    sources: [
      '../../packages/player/src',
      '../../packages/offline/src',
      '../../packages/career/src',
      '../../packages/contracts/src',
    ],
  },
  {
    from: '../../packages/offline/dist/savanna-sw.js',
    to: 'public/savanna-sw.js',
    sources: ['../../packages/offline/src', '../../packages/contracts/src'],
  },
];

function newestChange(path) {
  const stats = statSync(path);
  if (!stats.isDirectory()) return stats.mtimeMs;
  return readdirSync(path).reduce(
    (newest, entry) => Math.max(newest, newestChange(join(path, entry))),
    stats.mtimeMs,
  );
}

mkdirSync(resolve(root, 'public'), { recursive: true });
for (const { from, to, sources } of files) {
  const bundle = resolve(root, from);
  if (!existsSync(bundle)) {
    console.error(`Missing ${from}. Run "pnpm build" at the repository root first.`);
    process.exit(1);
  }
  const stale = sources.some(
    (source) => newestChange(resolve(root, source)) > statSync(bundle).mtimeMs,
  );
  if (stale) {
    console.error(`${from} is older than its source. Run "pnpm build" at the repository root.`);
    process.exit(1);
  }
  copyFileSync(bundle, resolve(root, to));
}
