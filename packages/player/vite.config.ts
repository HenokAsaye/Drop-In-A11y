import { defineConfig } from 'vite';

// Lit and every workspace package are bundled in, so host websites only add a script tag.
export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: true,
    lib: {
      entry: 'src/index.ts',
      name: 'SavannaBridgePlayer',
      formats: ['es', 'iife'],
      fileName: (format) => (format === 'iife' ? 'bridge-player.js' : 'bridge-player.es.js'),
    },
  },
});
