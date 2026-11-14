import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'offline',
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
  },
});
