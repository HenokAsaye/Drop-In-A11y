import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*/vitest.config.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/generated/**', '**/index.ts', 'packages/offline/src/service-worker.ts'],
      reporter: ['text', 'lcov'],
    },
  },
});
