import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'player',
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
  },
});
