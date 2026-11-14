// Copies the compiled plugin bundle into public/ so the demo loads it exactly like a host site would.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const files = [
  ['../../packages/player/dist/bridge-player.js', 'public/bridge-player.js'],
  ['../../packages/offline/dist/savanna-sw.js', 'public/savanna-sw.js'],
];

mkdirSync(resolve(root, 'public'), { recursive: true });
for (const [from, to] of files) {
  const source = resolve(root, from);
  if (!existsSync(source)) {
    console.error(`Missing ${from}. Run "pnpm build" at the repository root first.`);
    process.exit(1);
  }
  copyFileSync(source, resolve(root, to));
}
